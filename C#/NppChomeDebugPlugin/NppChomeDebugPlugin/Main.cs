using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using NppPluginNET;

namespace NppChomeDebugPlugin
{
    class Main
    {
        #region " Fields "
        internal const string PluginName = "Chome Debug";
        static string iniFilePath = null;
        static bool someSetting = false;
        public static frmChromeDebugDlg frmChromeDebugDlg = null;
        static int idChromeDebugDlg = -1;
        static Bitmap tbBmp = Properties.Resources.star;
        static Bitmap tbBmp_tbTab = Properties.Resources.star_bmp;
        static Icon tbIcon = null;

        public const int MARKER_BREAK = 3;
        public const int MARKER_CURRENT_POS = 4;

        static bool MarkersInitiated = false;
        public static string DllPath = "";

        #endregion

        #region " StartUp/CleanUp "

        internal static void CommandMenuInit()
        {
            StringBuilder sbIniFilePath = new StringBuilder(Win32.MAX_PATH);
            Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_GETPLUGINSCONFIGDIR, Win32.MAX_PATH, sbIniFilePath);
            iniFilePath = sbIniFilePath.ToString();
            if (!Directory.Exists(iniFilePath)) Directory.CreateDirectory(iniFilePath);
            iniFilePath = Path.Combine(iniFilePath, PluginName + ".ini");
            someSetting = (Win32.GetPrivateProfileInt("SomeSection", "SomeKey", 0, iniFilePath) != 0);

            PluginBase.SetCommand(0, "Chrome Debugger", ChromeDebugDialog, new ShortcutKey(false, true, false, Keys.D)); idChromeDebugDlg = 0;
            PluginBase.SetCommand(1, "Toggle breakpoint", ToggleBreakpoint, new ShortcutKey(false, true, false, Keys.B));
            PluginBase.SetCommand(2, "Continue", DebugResume, new ShortcutKey(false, true, false, Keys.F8));
            PluginBase.SetCommand(3, "Pause", DebugPause, new ShortcutKey(false, true, false, Keys.F9));
            PluginBase.SetCommand(4, "Step over", DebugStepOver, new ShortcutKey(false, true, false, Keys.F10));
            PluginBase.SetCommand(5, "Step into", DebugStepInto, new ShortcutKey(false, true, false, Keys.F11));
            PluginBase.SetCommand(6, "Step out", DebugStepOut, new ShortcutKey(false, true, false, Keys.F12));

            DllPath = Path.GetDirectoryName(Assembly.GetCallingAssembly().Location);
        }

        internal static void SetToolBarIcon()
        {
            toolbarIcons tbIcons = new toolbarIcons();
            tbIcons.hToolbarBmp = tbBmp.GetHbitmap();
            IntPtr pTbIcons = Marshal.AllocHGlobal(Marshal.SizeOf(tbIcons));
            Marshal.StructureToPtr(tbIcons, pTbIcons, false);
            Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_ADDTOOLBARICON, PluginBase._funcItems.Items[idChromeDebugDlg]._cmdID, pTbIcons);
            Marshal.FreeHGlobal(pTbIcons);
        }
        internal static void PluginCleanUp()
        {
            Win32.WritePrivateProfileString("SomeSection", "SomeKey", someSetting ? "1" : "0", iniFilePath);
        }
        #endregion

        #region " Menu functions "

        internal static void ChromeDebugDialog()
        {
            if (frmChromeDebugDlg == null)
            {
                frmChromeDebugDlg = new frmChromeDebugDlg();

                using (Bitmap newBmp = new Bitmap(16, 16))
                {
                    Graphics g = Graphics.FromImage(newBmp);
                    ColorMap[] colorMap = new ColorMap[1];
                    colorMap[0] = new ColorMap();
                    colorMap[0].OldColor = Color.Fuchsia;
                    colorMap[0].NewColor = Color.FromKnownColor(KnownColor.ButtonFace);
                    ImageAttributes attr = new ImageAttributes();
                    attr.SetRemapTable(colorMap);
                    g.DrawImage(tbBmp_tbTab, new Rectangle(0, 0, 16, 16), 0, 0, 16, 16, GraphicsUnit.Pixel, attr);
                    tbIcon = Icon.FromHandle(newBmp.GetHicon());
                }

                NppTbData _nppTbData = new NppTbData();
                _nppTbData.hClient = frmChromeDebugDlg.Handle;
                _nppTbData.pszName = "Chrome Debug";
                _nppTbData.dlgID = idChromeDebugDlg;
                _nppTbData.uMask = NppTbMsg.DWS_DF_CONT_BOTTOM | NppTbMsg.DWS_ICONTAB | NppTbMsg.DWS_ICONBAR | NppTbMsg.DWS_DF_FLOATING;
                _nppTbData.hIconTab = (uint)tbIcon.Handle;
                _nppTbData.pszModuleName = PluginName;
                IntPtr _ptrNppTbData = Marshal.AllocHGlobal(Marshal.SizeOf(_nppTbData));
                Marshal.StructureToPtr(_nppTbData, _ptrNppTbData, false);

                Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_DMMREGASDCKDLG, 0, _ptrNppTbData);
            }
            else
            {
                Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_DMMSHOW, 0, frmChromeDebugDlg.Handle);
            }
        }

        static void ToggleBreakpoint()
        {
            bool Add;

            InitMarkers();

            if (frmChromeDebugDlg != null)
            {
                int LineNr = (int)Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_GETCURRENTLINE, 0, 0);
                int LineHasMarker = (int)Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_MARKERGET, LineNr, 0);

                if (LineHasMarker == (1 << MARKER_BREAK) || LineHasMarker == ((MARKER_BREAK * MARKER_CURRENT_POS) << 1))
                {
                    Add = false;
                }
                else
                {
                    Add = true;
                }

                frmChromeDebugDlg.ObjectForScripting.AddRemoveBreakpoint(NppGetCurrentFile(), LineNr + 1, Add);
            }
        }

        static void DebugResume()
        {
            frmChromeDebugDlg.ObjectForScripting.DebugResume();
        }

        static void DebugPause()
        {
            frmChromeDebugDlg.ObjectForScripting.DebugPause();
        }

        static void DebugStepOver()
        {
            frmChromeDebugDlg.ObjectForScripting.DebugStepOver();
        }

        static void DebugStepInto()
        {
            frmChromeDebugDlg.ObjectForScripting.DebugStepInto();
        }

        static void DebugStepOut()
        {
            frmChromeDebugDlg.ObjectForScripting.DebugStepOut();
        }

        public static void NppAddMarker(int LineNr, int Marker = MARKER_BREAK)
        {
            //Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_MARKERSETBACK, Marker, 0xff0000);
            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_MARKERADD, LineNr, Marker);
        }

        public static void NppDeleteMarker(int LineNr, int Marker = MARKER_BREAK)
        {
            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_MARKERDELETE, LineNr, Marker);
        }

        public static void NppRemoveAllBreakpoints(int Marker = MARKER_BREAK)
        {
            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_MARKERDELETEALL, Marker, 0);
        }

        public static object[] NppGetOpenedFiles()
        {
            int Index = 0;
            int FileCount = (int)Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_GETNBOPENFILES, 0, 0);
            Object[] Files = new object[FileCount*2];

            using (ClikeStringArray cStrArray = new ClikeStringArray(FileCount, Win32.MAX_PATH))
            {
                if (Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_GETOPENFILENAMES, cStrArray.NativePointer, FileCount - 1) != IntPtr.Zero)
                {
                    foreach (string FilePath in cStrArray.ManagedStringsUnicode)
                    {
                        Files[Index] = FilePath;

                        if (File.Exists(FilePath))
                        {
                            Files[Index + 1] = Convert.ToBase64String( MD5.Create().ComputeHash(File.ReadAllBytes(FilePath)) );
                        }
                        else
                        {
                            Files[Index + 1] = "";
                        }

                        Index+=2;
                    }
                }
            }

            return Files;
        }

        public static string NppGetCurrentFile()
        {
            StringBuilder CurrentFile = new StringBuilder(Win32.MAX_PATH);
            Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_GETFULLCURRENTPATH, 0, CurrentFile);

            return CurrentFile.ToString();
        }

        public static void NppActivateDoc(string FilePath)
        {

            object[] Files = NppGetOpenedFiles();

            for (int Index = 0; Index < Files.Length; Index+=2 )
            {
                if (Files[Index].ToString() == FilePath)
                {
                    Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_ACTIVATEDOC, 0, Index/2);

                    break;
                }
            }
        }

        public static void NppGotoLine(int LineNr, int Color = 0xff0000)
        {
            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_GOTOLINE, LineNr - 1, 0);
        }

        public static void NppSetCaretLineBack(int Color = 0)
        {
            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_SETCARETLINEBACK, Color, 0);
        }

        public static void NppSetPosition(int Pos)
        {
            int CurrentPos = (int) Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_GETCURRENTPOS, 0, 0);

            Win32.SendMessage(PluginBase.GetCurrentScintilla(), SciMsg.SCI_SETCURRENTPOS, CurrentPos + Pos, 0);
            
        }

        public static void NppOpenFile(string FilePath)
        {
            if (File.Exists(FilePath))
            {
                Win32.SendMessage(PluginBase.nppData._nppHandle, NppMsg.NPPM_DOOPEN, IntPtr.Zero, FilePath);
            }
        }

        static void InitMarkers()
        {
            if (!MarkersInitiated)
            {
                Bitmap Bmp1, Bmp2;
                string Image1, Image2;

                Bmp1 = new Bitmap(DllPath + "/ChromeDebug/images/breakpoint.bmp");
                Bmp1.MakeTransparent(Color.Black);
                Image1 = Pixmap.FromBitmap(Bmp1).GetPixmap();
                Bmp1.Dispose();

                Win32.SendMessage(PluginBase.nppData._scintillaMainHandle, SciMsg.SCI_MARKERDEFINEPIXMAP, MARKER_BREAK, Image1);

                Bmp2 = new Bitmap(DllPath + "/ChromeDebug/images/currentpos.bmp");
                Bmp2.MakeTransparent(Color.Black);
                Image2 = Pixmap.FromBitmap(Bmp2).GetPixmap();
                Bmp2.Dispose();

                Win32.SendMessage(PluginBase.nppData._scintillaMainHandle, SciMsg.SCI_MARKERDEFINEPIXMAP, MARKER_CURRENT_POS, Image2);
            }

            MarkersInitiated = true;
        }
        #endregion
    }
}