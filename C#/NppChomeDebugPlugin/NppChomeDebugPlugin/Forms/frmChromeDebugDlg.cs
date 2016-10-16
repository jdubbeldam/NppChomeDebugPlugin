using Microsoft.Win32;
using NppPluginNET;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace NppChomeDebugPlugin
{
    public partial class frmChromeDebugDlg : Form
    {
        public JavascriptFunctions ObjectForScripting;

        public frmChromeDebugDlg()
        {
            SetWebBrowserFeatures();

            InitializeComponent();

            try
            {
                ObjectForScripting = new JavascriptFunctions(Browser);

                
                Browser.AllowNavigation = true;
                Browser.ObjectForScripting = ObjectForScripting;
                Browser.Url = new Uri(Main.DllPath + "/ChromeDebug/ChromeDebug.htm");
                Browser.WebBrowserShortcutsEnabled = false;
            }
            catch (Exception e)
            {
                MessageBox.Show(e.ToString());
            }
        }

        // set WebBrowser features, more info: http://stackoverflow.com/a/18333982/1768303
        static void SetWebBrowserFeatures()
        {
            // don't change the registry if running in-proc inside Visual Studio
            if (LicenseManager.UsageMode != LicenseUsageMode.Runtime)
                return;

            var appName = System.IO.Path.GetFileName(System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName);

            var featureControlRegKey = @"HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\Main\FeatureControl\";

            Registry.SetValue(featureControlRegKey + "FEATURE_BROWSER_EMULATION", appName, GetBrowserEmulationMode(), RegistryValueKind.DWord);

            // enable the features which are "On" for the full Internet Explorer browser
            Registry.SetValue(featureControlRegKey + "FEATURE_AJAX_CONNECTIONEVENTS", appName, 1, RegistryValueKind.DWord);
            Registry.SetValue(featureControlRegKey + "FEATURE_WEBSOCKET", appName, 1, RegistryValueKind.DWord);
        }

        static UInt32 GetBrowserEmulationMode()
        {
            int browserVersion = 0;
            using (var ieKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Internet Explorer",
                RegistryKeyPermissionCheck.ReadSubTree,
                System.Security.AccessControl.RegistryRights.QueryValues))
            {
                var version = ieKey.GetValue("svcVersion");
                if (null == version)
                {
                    version = ieKey.GetValue("Version");
                    if (null == version)
                        throw new ApplicationException("Microsoft Internet Explorer is required!");
                }
                int.TryParse(version.ToString().Split('.')[0], out browserVersion);
            }

            if (browserVersion < 7)
            {
                throw new ApplicationException("Unsupported version of Microsoft Internet Explorer!");
            }

            UInt32 mode = 11000; // Internet Explorer 11. Webpages containing standards-based !DOCTYPE directives are displayed in IE11 Standards mode. 

            switch (browserVersion)
            {
                case 7:
                    mode = 7000; // Webpages containing standards-based !DOCTYPE directives are displayed in IE7 Standards mode. 
                    break;
                case 8:
                    mode = 8000; // Webpages containing standards-based !DOCTYPE directives are displayed in IE8 mode. 
                    break;
                case 9:
                    mode = 9000; // Internet Explorer 9. Webpages containing standards-based !DOCTYPE directives are displayed in IE9 mode.                    
                    break;
                case 10:
                    mode = 10000; // Internet Explorer 10.
                    break;
            }

            return mode;
        }
    }

    [ComVisible(true)]
    public class JavascriptFunctions
    {
        private WebBrowser Browser;
        private Process ChromeProc;

        public JavascriptFunctions(WebBrowser Browser)
        {
            this.Browser = Browser;
        }

        public void ChromeStart(string Url)
        {
            bool IsOpen = false;

            ChromeProc = null;

            // Check if Chrome process is already available
            string WmiQuery = "select ProcessId, CommandLine from Win32_Process where Name='chrome.exe'";
            ManagementObjectSearcher searcher = new ManagementObjectSearcher(WmiQuery);
            ManagementObjectCollection ObjectCollection = searcher.Get();

            foreach (ManagementObject Item in ObjectCollection)
            {
                if (Item["CommandLine"].ToString().Contains("--remote-debugging-port=9222"))
                {
                    ChromeProc = Process.GetProcessById(Convert.ToInt32(Item["ProcessId"]));

                    ChromeStop();

                    Thread.Sleep(200);

                    ChromeProc = null;

                    break;
                }
            }

            // Start Chrome if process does not already exist
            if (ChromeProc == null)
            {
                string ChromePath = (string)Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe", "", "");

                ChromeProc = Process.Start(ChromePath, Url + " --remote-debugging-port=9222");
            }

            Thread.Sleep(200);

            IsOpen = IsPortOpen("127.0.0.1", 9222, 30);

            if (IsOpen)
            {
                Thread.Sleep(200);

                Browser.Document.InvokeScript("OnChromeStarted", new Object[] { "http://127.0.0.1:9222/json/list" });
            }
        }

        bool IsPortOpen(string Host, int Port, int Wait)
        {
            DateTime Start = DateTime.Now;

            while ((DateTime.Now - Start).TotalSeconds < Wait)
            {
                try
                {
                    using (TcpClient Client = new TcpClient())
                    {
                        IAsyncResult Result = Client.BeginConnect(Host, Port, null, null);
                        bool Success = Result.AsyncWaitHandle.WaitOne(new TimeSpan(0, 0, 1));
                        Client.EndConnect(Result);

                        if (Success)
                        {
                            return true;
                        }
                    }

                }
                catch { }

                Thread.Sleep(100);
            }

            return false;
        }

        public void ChromeStop()
        {
            if (ChromeProc != null)
            {
                if (ChromeProc.CloseMainWindow())
                {
                    ChromeProc.WaitForExit(2000);
                }
                else
                {
                    ChromeProc.Kill();
                }
            }
        }

        public string FileSearchForContent(string FilePath, string SearchString, bool MatchCase = true)
        {
            string Lines = "[";
            int LineNr = 1;
            StringComparison Case = StringComparison.Ordinal;

            if (File.Exists(FilePath))
            {
                if (!MatchCase)
                {
                    Case = StringComparison.OrdinalIgnoreCase;
                }

                foreach (string Line in File.ReadAllLines(FilePath))
                {
                    if (Line.IndexOf(SearchString, Case) >= 0)
                    {
                        if (Lines.Length > 1)
                        {
                            Lines += ",";
                        }

                        Lines += LineNr;
                    }

                    LineNr++;
                }
            }

            Lines += "]";

            return Lines;
        }

        public string FileGetContents(string FilePath, bool RealPath = false)
        {
            try
            {
                if (RealPath)
                {
                    return File.ReadAllText(FilePath);
                }
                else
                {
                    return File.ReadAllText(Main.DllPath + "/ChromeDebug/" + FilePath.Replace("..", ""));
                }
            }
            catch
            {
                return "";
            }
        }

        public void FilePutContents(string FilePath, string Contents, bool Append = false)
        {
            FilePath = Main.DllPath + "/ChromeDebug/" + FilePath.Replace("..", "");

            try
            {
                if (Append)
                {
                    File.AppendAllText(FilePath, Contents);
                }
                else
                {
                    File.WriteAllText(FilePath, Contents);
                }
            }
            catch { }
        }

        public void SelectDirectory(string Target, string CurrentDir = "")
        {
            FolderBrowserDialog Dir = new FolderBrowserDialog();
            Dir.SelectedPath = CurrentDir;
            Dir.ShowDialog();

            if (Dir.SelectedPath != null)
            {
                Browser.Document.InvokeScript("SetTarget", new object[] { Target, Dir.SelectedPath });
            }
        }

        public void SelectFile(string Target, string Filter="", string CurrentFile = "")
        {
            OpenFileDialog Dialog = new OpenFileDialog();

            if (CurrentFile != "")
            {
                FileInfo Fo = new FileInfo(CurrentFile);
                Dialog.InitialDirectory = Fo.DirectoryName;
            }

            if (Filter != "")
            {
                Dialog.Filter = Filter;
            }

            Dialog.ShowDialog();

            if (Dialog.FileName != null)
            {
                Browser.Document.InvokeScript("SetTarget", new object[] { Target, Dialog.FileName });
            }
        }

        public bool IsDirectory(string Target, string Dir)
        {
            bool IsDir = Directory.Exists(Dir);

            if (IsDir)
            {
                Browser.Document.InvokeScript("SetTarget", new object[] { Target, Dir });
            }
            else
            {
                MessageBox.Show("'" + Dir + "' is not a valid directory.");
            }

            return IsDir;
        }

        public bool IsFile(string Target, string FileName)
        {
            bool IsFile = File.Exists(FileName);

            if (IsFile)
            {
                Browser.Document.InvokeScript("SetTarget", new object[] { Target, FileName });
            }
            else
            {
                MessageBox.Show("'" + FileName + "' is not a valid file.");
            }

            return IsFile;
        }

        public bool IsUrl(string Url)
        {
            bool IsUrl = Uri.IsWellFormedUriString(Url, UriKind.Absolute);

            if (IsUrl)
            {
                Browser.Document.InvokeScript("SetChromeUrl", new object[] { Url });
            }
            else
            {
                MessageBox.Show("'" + Url + "' is not a valid url.");
            }

            return IsUrl;
        }


        public void AddRemoveBreakpoint(string FilePath, int LineNr, bool Add)
        {
            Browser.Document.InvokeScript("ChromeAddRemoveBreakpoint", new object[] { FilePath, LineNr, Add });
        }

        public void DebugResume()
        {
            Browser.Document.InvokeScript("ChromeResume", new object[] {});
        }

        public void DebugPause()
        {
            Browser.Document.InvokeScript("ChromePause", new object[] { });
        }

        public void DebugStepOver()
        {
            Browser.Document.InvokeScript("ChromeStepOver", new object[] { });
        }

        public void DebugStepInto()
        {
            Browser.Document.InvokeScript("ChromeStepInto", new object[] { });
        }

        public void DebugStepOut()
        {
            Browser.Document.InvokeScript("ChromeStepOut", new object[] { });
        }

        public void NppAddMarker(int LineNr, int Marker = Main.MARKER_BREAK)
        {
            Main.NppAddMarker(LineNr, Marker);
        }

        public void NppDeleteMarker(int LineNr, int Marker = Main.MARKER_BREAK)
        {
            Main.NppDeleteMarker(LineNr, Marker);
        }

        public void NppGetOpenedFiles()
        {
            Browser.Document.InvokeScript("SetOpenedFiles", Main.NppGetOpenedFiles());
        }

        public string NppGetCurrentFile()
        {
            return Main.NppGetCurrentFile();
        }

        public void NppActivateDoc(string FilePath)
        {
            Main.NppActivateDoc(FilePath);
        }

        public void NppGotoLine(int LineNr)
        {
            Main.NppGotoLine(LineNr);
        }

        public void NppSetPosition(int Pos)
        {
            Main.NppSetPosition(Pos);
        }

        public void NppOpenFile(string FilePath)
        {
            Main.NppOpenFile(FilePath);
        }

        public void NppRemoveAllBreakpoints(int Marker = Main.MARKER_BREAK)
        {
            Main.NppRemoveAllBreakpoints(Marker);
        }

        public void NppSetCaretLineBack(int Color)
        {
            Main.NppSetCaretLineBack(Color);
        }
    }
}
