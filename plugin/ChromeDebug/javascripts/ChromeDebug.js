var
LOG_ENABLED			= false,
AppFiles			= {},
NppFiles			= {},
ChromeUse			= false,
ChromeUrl			= '',
ChromeDir			= '',
ChromeStart			= true,
NodeUse				= false,
NodeScript			= '',
NodeExePath			= '',
NodeParams			= '',
NodeExeType			= '',
NodeStart			= true,
NodeWorkingDirectory= '',
Breakpoints			= {},
AppWs				= {},
CallId				= 0,
CallbackByCallId	= {},
CurrentDebugFile	= "",
CurrentBreakpoint	= {},
AppendToLog			= false,
ActiveTabId			= "",
ConsoleLineNr		= 0,
ActiveTypes			= {}
;

$(document).ready(		
	function() {		
		$('#tabs').tabs();
	
		$('#tabs').click('tabsselect',
			function (event, ui) {
				ActiveTabId = $('#tabs .ui-tabs-panel[aria-hidden="false"]').prop('id');
	
				switch (ActiveTabId) {
					case 'files':
						ShowFiles();
				}
			}			
		);
		
		SelectTab('console');
	
		GetConfig();
		
		if (ChromeUse) {
			$('#activetype').append($('<option>', { value: 'Chrome'}).text('Chrome'));
		}
		
		if (NodeUse) {
			$('#activetype').append($('<option>', { value: 'NodeJs'}).text('NodeJs'));
		}
		
		$('#chromedir')
			.val(ChromeDir)
			.change(
				function() {
					if (!window.external.IsDirectory('#chromedir', $(this).val() )) {
						$(this).val(ChromeDir);
					} else {
						ChromeDir = $(this).val();
					}
				}
			)
		;
		
		$('#nodescript')
			.val(NodeScript)
			.change(
				function() {
					if (!window.external.IsDirectory('#nodescript', $(this).val() )) {
						$(this).val(NodeScript);
					} else {
						NodeScript = $(this).val();
					}
				}
			)
		;
		
		$('#chromeurl')
			.val(ChromeUrl)
			.change(
				function() {
					if (!window.external.IsUrl('#chromeurl', $(this).val() )) {
						$(this).val(ChromeUrl);	
					} else {
						ChromeUrl = $(this).val();
					}
				}
			)
		;			
		
		$('#nodeexepath')
			.val(NodeExePath)
			.change(
				function() {
					var Valid,
					Val = $(this).val();
					
					if (Val.indexOf('://') > -1) {
						Valid = window.external.IsUrl('#nodeexepath', Val );
					} else {
						Valid = window.external.IsFile('#nodeexepath', Val );					
					}
					
					if (!Valid) {
						$(this).val(NodeExePath);	
					} else {
						NodeExePath = Val;
					}
					
					SetNodeExeType();
				}
			)
		;
		
		SetNodeExeType();
		
		$('#nodeuse')
			.attr('checked', NodeUse)
			.click(
				function() {
					NodeUse = $(this).attr('checked');
					
					SetNodeConfig();
				}
			)
		;
		
		SetNodeConfig();
		
		$('#chromeuse')
			.attr('checked', ChromeUse)
			.click(
				function() {
					ChromeUse = $(this).attr('checked');
					
					SetChromeConfig();
				}
			)
		;
		
		SetChromeConfig();
		
		$('#chromestart')
			.attr('checked', ChromeStart)
			.click(
				function() {
					ChromeStart = $(this).attr('checked');
				}
			)
		;

		$('#nodeparams')
			.val(NodeParams)
			.change(
				function() {
					NodeParams = $(this).val();
				}
			)
		;			
		
		
		$('#nodestart')
			.attr('checked', NodeStart)
			.click(
				function() {
					NodeStart = $(this).attr('checked');
				}
			)
		;
		
		$('#restart').click(
			function() {
				var Type = $('#activetype').val();
				
				$('#console').html('&nbsp;');
				
				WsClose(Type);
				
				//NppRemoveAllBreakpoints();
				switch(Type) {
					case 'NodeJs':
						if (NodeUse) {
							StartNode(NodeExePath, NodeScript, NodeParams);
						}

						break;
					case 'Chrome':
						if (ChromeUse) {
							StartChrome(ChromeUrl);
						}
						
						break;
				}
			}
		);
		
		$('#startsearch').click(
			function() {
				StartSearch();
			}
		);
		
		$('#startevaluate').click(
			function() {
				Evaluate($('#evaluatestring').val());
			}
		);
		
		$('#reload').click(
			function() {
				Reload();
			}
		);

		$('img[name="finddirectory"]').click(
			function() {
				window.external.SelectDirectory($(this).attr('target'), $($(this).attr('target')).val());
			}
		);
		
		$('img[name="findfile"]').click(
			function() {
				var
				Filter	= '',
				Target	= $(this).attr('target'),
				Script	= $(Target).val();
				
				if (!Script) {
					Script = '';
				}
				
				switch (Target) {
					case '#nodescript':
						Filter = 'Javascript files (*.js)|*.js';
						
						break;
					case '#nodeexepath':
						Filter = 'NodeJs exe file (*.exe)|*.exe';
						
						break;
				}

				window.external.SelectFile(Target, Filter, Script);
			}
		);
		
		
		$('#searchstring').on('keypress', function (e) {
			if(e.which === 13){
				StartSearch();
			}
		});
		
		$('#evaluatestring').on('keypress', function (e) {
			if(e.which === 13){
				Evaluate($('#evaluatestring').val());
			}
		});
		
		$('#activetype').on('change', function() {
			ChangeActiveType($(this).val());
		});
		
		NppRemoveAllBreakpoints();

		NppGetOpenedFiles();

		if (NodeUse && NodeStart) {
			StartNode(NodeExePath, NodeScript, NodeParams);
		}
		
		if (ChromeUse && ChromeStart) {
			StartChrome(ChromeUrl);
		}
		
		document.focus();
	}
);

$(window).unload(
	function() {
		WsClose();
		SaveConfig();
		NppSetCaretLineBack(0);
		ChromeStop();
		NodeStop();
	}
);

String.prototype.replaceAll = function(strReplace, strWith) {
	var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	var reg = new RegExp(esc, 'ig');
	return this.replace(reg, strWith);
};

// Browser ==========================================================================================================

function GetConfig() {
	var Config = FileGetContents('config.json');

	if (Config) {
		Config = JSON.parse(Config);
	
		ChromeUse 	= Config.ChromeUse;
		ChromeDir	= Config.ChromeDir;
		ChromeUrl	= Config.ChromeUrl;
		ChromeStart	= Config.ChromeStart;
		NodeUse 	= Config.NodeUse;
		NodeExePath	= Config.NodeExePath;
		NodeParams	= Config.NodeParams;
		NodeScript	= Config.NodeScript;
		NodeStart 	= Config.NodeStart;
		
		if (Config.Breakpoints) {
			Breakpoints	= Config.Breakpoints;
		}
	}
}

function SaveConfig() {
	var Config = {
		ChromeUse 		: ChromeUse,
		ChromeUrl 		: ChromeUrl,
		ChromeDir 		: ChromeDir,
		ChromeStart 	: ChromeStart,
		NodeUse 		: NodeUse,
		NodeExePath		: NodeExePath,
		NodeParams		: NodeParams,
		NodeScript		: NodeScript,
		NodeStart 		: NodeStart,
		Breakpoints		: Breakpoints
	}

	FilePutContents('config.json', JSON.stringify(Config));
}

function SetNodeConfig() {
	if ($('#nodeuse').attr('checked')) {
		$('#nodeconfig').css('display', 'block');
	} else {
		$('#nodeconfig').css('display', 'none');
	}
}

function SetChromeConfig() {
	if ($('#chromeuse').attr('checked')) {
		$('#chromeconfig').css('display', 'block');
	} else {
		$('#chromeconfig').css('display', 'none');
	}
}

function SetNodeExeType() {
	if ($('#nodeexepath').val().indexOf('://') > -1) {
		NodeExeType = 'ws';
		
		$('#nodestart').attr('disabled', true);
	} else {
		NodeExeType = 'exe';
		
		$('#nodestart').attr('disabled', false);;
	}
}

function OnChromeStarted(Url) {
	$.ajax({
		type:		"GET",
		url:		Url,
		cache:		false,
		success:	function(Data) {
						var AppNr, App;
								
						for (AppNr in Data) {
							App = Data[AppNr]; 
							
							if (App.url == ChromeUrl) {
								OpenWsDebug('Chrome', App.webSocketDebuggerUrl);
							}
						}
					}
		,
		error:		function(xhr, status, error) {
						alert("Error1: " + error);						
					}
		,
		dataType: "json"
	});
}

function OnNodeStarted(WsUrl, WorkingDirectory) {
	NodeWorkingDirectory = WorkingDirectory;
	
	OpenWsDebug('NodeJs', WsUrl);
}

function OpenWsDebug(Type, WsUrl) {
	if (!AppWs[Type]) {
		AppWs[Type] = {};
	}
	
	ActiveTypes[Type] = true;
	
	$('#activetype option:contains("' + Type + '")').text(Type + '  (running)');
	$('#activetype').val(Type);
	
	AppWs[Type] = new WebSocket(WsUrl);

	AppWs[Type].onopen = function (evt) {									
		WsSend(Type, '{"method": "Debugger.enable", "id": ' + GetCallId() + ', "params": {}}');
		WsSend(Type, '{"method": "Debugger.canSetScriptSource", "id": ' + GetCallId() + ', "params": {}}');
		//WsSend(Type, '{"method": "Console.enable", "id": ' + GetCallId() + ', "params": {}}');
		WsSend(Type, '{"method": "Runtime.enable", "id": ' + GetCallId() + ', "params": {}}');

		// Keep connection alive
		setInterval(
			function() {
				if (AppWs[Type] && AppWs[Type].send) { 
					AppWs[Type].send(Type, "");
				}
			}
			,
			5000
		);
	}

	AppWs[Type].onerror = function (evt) {					
		//alert("WebSocket error: " + JSON.stringify(evt));
	};

	AppWs[Type].onmessage = function (evt) {
		var Data = JSON.parse(evt.data);

		if (!Data.error) {
			ToLog("\n=== Receive ======================================\n" + Type + ": " + evt.data + "\n");
		}

		if (Data.method) {
			switch (Data.method) {
				case 'Debugger.scriptParsed':
					AddScript(Type, Data.params);

					break;
				case 'Debugger.paused':
					HitBreakpoint(Type, Data.params);

					break;
				case 'Runtime.consoleAPICalled':
					ConsoleMessage(Type, Data.params);
				
					break;
					//
				//case 'Console.messageAdded':
				//	ConsoleMessage(Type, Data.params);
				//
				//	break;
			}
		}

		if (Data.id && Data.result && CallbackByCallId[Data.id]) {
			CallbackByCallId[Data.id].Func(Data.result, CallbackByCallId[Data.id].Data);

			delete CallbackByCallId[Data.id];
		}
	};

	AppWs[Type].onclose = function() { 
		$('#activetype option:contains("' + Type + '")').text(Type);
		
		delete AppWs[Type];
		AppWs[Type] = null;
	};
}

function StartSearch() {
	ShowFiles($('#searchstring').val(), $('#matchcase').attr('checked') ? true : false);
}

function WsSend(Type, Message) {
	if (AppWs[Type]) {
		ToLog("\n=== Send ======================================\n" + Type + ": " + Message + "\n");
		
		AppWs[Type].send(Message);
	}
}

function WsClose(Type /*optional*/) {
	var Type_,
	Close =	function(Type) {
				if (AppWs[Type] && AppWs[Type].close) {
					AppWs[Type].close();

					AppWs[Type] = null;
				}
			}
	;
	
	if (Type) {
		Close(Type);
	} else {
		for (Type_ in AppWs) {
			Close(Type_);
		}
	}
}

function SetOpenedFiles() {
	var Index, FilePath, File, Md5, Type, LineNr,
	BreakpointsRemove = {};

	NppFiles = {};
	
	for (Index=0; Index < arguments.length - 1; Index+=2) {
		FilePath = arguments[Index];

		
		NppFiles[GetHash(FilePath)] = arguments[Index + 1];
	}
		
	for (Hash in AppFiles) {		
		if (NppFiles[Hash]) {
			File		= AppFiles[Hash];
			File.Opened	= true;
			Md5			= NppFiles[Hash];
			
			if (Md5 && File.Md5 && Md5 != File.Md5) {	
				FileChanged(File);
			}
			
			File.Md5 = Md5;
		} else {
			AppFiles[Hash].Opened = false;
			
			if (Breakpoints[Hash]) {
				for (Type in Breakpoints[Hash]) {
					for (LineNr in Breakpoints[Hash][Type]) {
						AddRemoveBreakpoint(AppFiles[Hash].FilePath, LineNr, false, true);
					}
				}
				
				delete Breakpoints[Hash];
			}
		}
	}

	ShowFiles();
}

function FileChanged(File) {
	SetScriptSource(File);
}

function ShowFiles(SearchString /* optional */, MatchCase /* optional */) {
	var TreeContent, File, Parts, Index, MaxIndex, RelPath, Dir, LineNr, Info, Color, Add, LineIndex,
	Div		= SearchString ? '#searchresult' : '#files',
	Tree	= {'.': {}};

	$(Div).html('&nbsp;');		

	for (Hash in AppFiles) {
		File = AppFiles[Hash];

		Add = false;
		
		if (SearchString) {
			File.SearchLines = JSON.parse(window.external.FileSearchForContent(File.FilePath, SearchString, MatchCase));
			
			if (File.SearchLines.length) {
				Add = true;
			}
		} else {
			Add = true;
		}
		
		if (Add) {
			RelPath = File.FilePath;
			
			if (ChromeUse) {
				RelPath = RelPath.replaceAll(ChromeDir, "");
			}

			Parts	= RelPath.split('\\');
			MaxIndex= Parts.length - 1;
			Dir		= Tree['.'];
			for (Index in Parts) {
				if (!Dir[Parts[Index]]) {
					if (Index == MaxIndex) {
						Dir[Parts[Index]] = Hash;
					} else {
						Dir[Parts[Index]] = {};
					}
				}
				
				Dir = Dir[Parts[Index]];
			}
		}
	}
	
	TreeContent = function(Dir, Level) {
		var i, Hash, Item, Type,
		NameSort	= [],
		Spaces		= "",
		LineNrs		= {};

		for (i=0; i < 4*Level; i++) {
			Spaces += "&nbsp;";
		}
		
		for (Index in Dir) {
			NameSort.push(Index);
		}
		
		for (Item in NameSort.sort()) {
			Index	= NameSort[Item]
			Hash	= Dir[Index];
			
			if (typeof(Dir[Index]) == 'object') {
				$(Div).append(Spaces + '<b>' + Index + '</b><br />');
				
				TreeContent( Hash, Level + 1);
			} else {
				Info = "";
				
				if (SearchString) {
					for (LineIndex in AppFiles[Hash].SearchLines) {
						LineNr = AppFiles[Hash].SearchLines[LineIndex];
						
						Info += '&nbsp;&nbsp;<span style="text-decoration: underline; cursor: pointer; " onclick="GoToLine(\'' +  Hash + '\', ' + LineNr + ')">' + LineNr + '</span>';
					}
				} else {
					if (Breakpoints[Hash]) {
						LineNrs = {};
						
						for (Type in Breakpoints[Hash]) {
							for (LineNr in Breakpoints[Hash][Type]) {
								LineNrs[LineNr] = true;
							}
							
							for (LineNr in LineNrs) {
								Info += '&nbsp;&nbsp;<img src="images/breakpoint.bmp" title="Line: ' + LineNr + '" onclick="GoToLine(\'' +  Hash + '\', ' + LineNr + ')" style="cursor: pointer; " />';
							}
						}
					}
				}
				
				Color = "";
				if (AppFiles[Hash].Opened) {
					Color = 'color: green;';
				}
				
				$(Div).append(Spaces + '<span style="width: 250px; display: inline-block;"><span style="text-decoration: underline; cursor: pointer; ' + Color + '" id="' +  Hash + '" onclick="NppActivateDoc(this.id)" >' + Index + '</span></span>' + Info + '<br />' );
			}
		}
	}
	
	TreeContent(Tree['.'], 0);
}

function GoToLine(Hash, LineNr) {
	NppActivateDoc(Hash);
	NppGotoLine(LineNr);
}

function GetFileByScriptId(Type, ScriptId) {
	var File = null;

	for (Hash in AppFiles) {
		if (AppFiles[Hash].ScriptIds[Type] && AppFiles[Hash].ScriptIds[Type][ScriptId]) {
			File = AppFiles[Hash];

			break;
		}
	}

	return File;
}

function ToLog(Content) {
	if (LOG_ENABLED) {
		FilePutContents('log.txt', Content, AppendToLog);
	}
	
	if (!AppendToLog) {
		AppendToLog = true;
	}
}

function FilePutContents(FilePath, Content, Append /*=false*/, RealPath /*=false*/) {
	if (!Append) {
		Append = false;
	}
	
	if (!RealPath) {
		RealPath = false;
	}
	
	window.external.FilePutContents(FilePath, Content, Append, RealPath);
}

function FileGetContents(FilePath, RealPath) {
	if (!RealPath) {
		RealPath = false;
	}
	
	return window.external.FileGetContents(FilePath, RealPath);
}

function GetCallId() {
	return CallId++;
}

function GetFileByPath(FilePath) {
	return AppFiles[GetHash(FilePath)];
}

function GetHash(String) {
	return hex_md5(String.toLowerCase());
}

function SelectTab(Name) {
	$('#tabs a[href="#' + Name + '"]').click();
}


function ConsoleMessage(Type, Params) {
	var CallFrames, Text;
	
	if (Params.args) {
		if (Params.stackTrace && Params.stackTrace.callFrames) { 
			CallFrames = Params.stackTrace.callFrames;
		}
		
		if (Params.args[0]) {
			switch(Params.args[0].type) {
				case "string":
					Text = Params.args[0].value;
					
					break;
				case "object": //
					Text = '<span style="text-decoration: underline; cursor: pointer; " onclick=\'GetProperties("' + Type + '", JSON.stringify(\"' + Params.args[0].objectId.replaceAll('"', '\\"') +  '\"), true); SelectTab("watch"); \'>' + Params.args[0].description + '</span>';
					
					break;	
			}
		} else {
			Text = Params.args[0].value;
		}
		
		//if (Params.message.level == 'error') {
		//	Text = '<span style="color: red;">' + Text + '</span>';
		//}
		
		Text = '<span style="color: gainsboro; width: 150px;">' + Type + '</span>' + ': ' + Text;
		
		ConsoleLog(Text, Type, CallFrames);
	}
}

/*
function ConsoleMessage(Type, Params) {
	var CallFrames, Text;
	
	if (Params.message && Params.message.text) {
		if (Params.message.stack && Params.message.stack.callFrames) { 
			CallFrames = Params.message.stack.callFrames;
		}
		
		if (Params.message.parameters && Params.message.parameters[0]) {
			switch(Params.message.parameters[0].type) {
				case "string":
					Text = Params.message.text;
					
					break;
				case "object": //
					Text = '<span style="text-decoration: underline; cursor: pointer; " onclick=\'GetProperties("' + Type + '", JSON.stringify(\"' + Params.message.parameters[0].objectId.replaceAll('"', '\\"') +  '\"), true); SelectTab("watch"); \'>' + Params.message.parameters[0].description + '</span>';
					
					break;	
			}
		} else {
			Text = Params.message.text;
		}
		
		if (Params.message.level == 'error') {
			Text = '<span style="color: red;">' + Text + '</span>';
		}
		
		Text = '<span style="color: gainsboro; width: 150px;">' + Type + '</span>' + ': ' + Text;
		
		ConsoleLog(Text, Type, CallFrames);
	}
}
*/

function ConsoleLog(Message, Type  /*optional*/, CallFrames /*optional*/) {
	var File, Parts, ScriptId, LineNr, Index, Display,
	Id			= 'consoleline' + ConsoleLineNr,
	FileLineMenu= '',
	FileLine	= '';
	
	if (CallFrames) {
		for (Index in CallFrames) {
			ScriptId= CallFrames[Index].scriptId;
			LineNr	= CallFrames[Index].lineNumber;
			File	= GetFileByScriptId(Type, ScriptId);
			
			if (File) {
				Parts = File.FilePath.split('\\');
				
				if (Index > 0) {
					FileLineMenu += '<li><div style="text-decoration: underline;" onclick="GoToLine(\'' +  File.Hash + '\', ' + LineNr + ')" >' + Parts[Parts.length -1] + ', Line: ' + LineNr + '</div></li>';
				} else {
					FileLine = '<span style="text-decoration: underline; cursor: pointer; position: absolute; background-color: white; text-align: right; right: 30px;"  onclick="GoToLine(\'' +  File.Hash + '\', ' + LineNr + ')" >' + Parts[Parts.length -1] + ', Line: ' + LineNr + '</span>';
					
					if (CallFrames.length > 1) {
						FileLineMenu = '<ul id="' + Id + '" style="position: absolute; border: 0px; width: 15px; right: 5px;" ><li>..<ul style="width: 400px;">';
					}
				}
			}
		}
		
		if (FileLineMenu)  {
			FileLineMenu += '</ul></li></ul>';
		}
	}

	$('#console').prepend('<br />' + FileLine + FileLineMenu + Message + '<hr style="height:1px;border:none;color:gainsboro;background-color:gainsboro;">');
	
	$( "#" + Id).menu();
}

function ChangeActiveType(Type) {
	var ActiveType = ActiveTypes[Type];
	
	if (ActiveType && ActiveType !== true) {
		HitBreakpoint(Type);
	} else {
		Resume();
	}
}

function AddFile(FilePath) {
	var Hash = GetHash(FilePath);

	if (!AppFiles[Hash]) {
		AppFiles[Hash] = {
			Md5			: "",
			Hash 		: Hash,
			FilePath	: FilePath,
			Url			: "",
			Opened		: false,
			ScriptIds 	: {}
		};
		
		if (NppFiles[Hash]) {
			AppFiles[Hash].Md5		= NppFiles[Hash];
			AppFiles[Hash].Opened	= true;
		}
	}

	return AppFiles[Hash];
}

function Reload() {
	var Hash,
	CurrentDoc = NppGetCurrentFile();
	
	for (Hash in Breakpoints) {
		NppActivateDoc(Hash);
		NppRemoveAllBreakpoints(NPP.MARKER_BREAK);
		NppRemoveAllBreakpoints(NPP.MARKER_CURRENT_POS);
	}

	window.external.NppActivateDoc(CurrentDoc);
	
	window.location.reload();
}

function CleanUpDebugStep() {
	if (NppGetCurrentFile() != CurrentDebugFile) {
		NppActivateDoc(GetHash(CurrentDebugFile));
	}

	NppSetCaretLineBack(0);
	NppRemoveAllBreakpoints(NPP.MARKER_CURRENT_POS);
}

function SetTarget(Target, Value) {
	switch (Target) {
		case '#chromedir':
			if (Value.slice(-1) != '\\') {
				Value += '\\';
			}
			
			ChromeDir = Value;
			
			break;
		case '#chromeurl':
			ChromeUrl = Value;
			
			break;	
		case '#nodescript':
			NodeScript = Value;
			
			break;
		case '#nodeexepath':
			NodeExePath = Value;
			
			$(Target).val(Value);
			
			SetNodeExeType();
			
			break;
	}
	
	
	$(Target).val(Value);
}

// Npp ==========================================================================================================
var NPP = {
	MARKER_BREAK 		: 3,
	MARKER_CURRENT_POS 	: 4
}

function NppActivateDoc(Hash) {
	var File = AppFiles[Hash];

	if (File) {
		if (File.Opened) {
			window.external.NppActivateDoc(File.FilePath);
		} else {
			NppOpenFile(File.FilePath);
		}
	}
}

function NppGotoLine(LineNr) {
	window.external.NppGotoLine(LineNr);
}

function NppSetPosition(Pos) {
	window.external.NppSetPosition(Pos);
}

function NppOpenFile(FilePath) {
	window.external.NppOpenFile(FilePath);
}

function NppSetCaretLineBack(Color) {
	window.external.NppSetCaretLineBack(Color);
}

function NppRemoveAllBreakpoints(Marker) {
	if (Marker) {
		window.external.NppRemoveAllBreakpoints(Marker);
	} else {
		window.external.NppRemoveAllBreakpoints();
	}
}

function NppAddMarker(LineNr, Marker) {
	if (Marker) {
		window.external.NppAddMarker(LineNr, Marker);
	} else {
		window.external.NppAddMarker(LineNr);
	}
}

function NppDeleteMarker(LineNr, Marker) {
	if (Marker) {
		window.external.NppDeleteMarker(LineNr, Marker);
	} else {
		window.external.NppDeleteMarker(LineNr);
	}
}

function NppGetOpenedFiles() {
	window.external.NppGetOpenedFiles();
}

function NppGetCurrentFile() {
	return window.external.NppGetCurrentFile();
}

// Chrome debugger functions https://chromedevtools.github.io/debugger-protocol-viewer/

function StartChrome(Url) {
	window.external.ChromeStart(Url);
}

function ChromeStop() {
	window.external.ChromeStop();
}

function StartNode(ExePath, Script, Params) {
	if (NodeExeType == 'exe') {
		window.external.NodeStart(ExePath, Script, Params);
	} else {
		OnNodeStarted(NodeExePath);
	}
}

function NodeStop() {
	if (NodeExeType == 'exe') {
		window.external.NodeStop();
	}
}


function AddScript(Type, Params) {
	var FilePath, File, LineNr, CurrentFile, IsIndex,
	IsIndex	= false,
	Add		= true;
	
	if (Params.url) {
		FilePath	= Params.url
		
		switch (Type) {
			case 'Chrome':
				if (FilePath == ChromeUrl) {
					IsIndex = true;
				}
				
				FilePath = FilePath.split('?')[0].replaceAll(ChromeUrl, ChromeDir).replace(new RegExp('/', 'g'), '\\');
				
				if (IsIndex) {
					FilePath = window.external.FileSearch(FilePath, "index.*");
				}
				
				break;
			case 'NodeJs':
				if (FilePath.indexOf(':') == -1) {	
					FilePath = window.external.ToAbsolutePath(NodeWorkingDirectory, FilePath);
				} else {
					// Exclude files in node_modules
					if (FilePath.indexOf('node_modules') > -1) {
						Add = false;
					}
				}
				
				if (Add) {
					if (!window.external.FileExists(FilePath)) {
						Add = false;	
					}
				}
				
				break;
		}
		
		if (Add) {
			File		= AddFile(FilePath)
			File.Url	= Params.url;
			
			if (!File.ScriptIds[Type]) {
				File.ScriptIds[Type] = {};
			}
			
			File.ScriptIds[Type][Params.scriptId] = true;
			
			// Reset breakpoints
			if (Breakpoints[File.Hash]) {
				for (LineNr in Breakpoints[File.Hash][Type]) {
					CurrentFile = NppGetCurrentFile();
					
					NppActivateDoc(File.Hash);				
					NppAddMarker(LineNr - 1, NPP.MARKER_BREAK);
					window.external.NppActivateDoc(CurrentFile);
					
					AddRemoveBreakpoint(FilePath, LineNr, true, true);
				}
			}
		}
	}
}

function AddRemoveBreakpoint(FilePath, LineNr, Add, NoCallback) {
	var Url, Id, Type, ScriptId,
	File = GetFileByPath(FilePath);

	if (File) {
		for (Type in ActiveTypes) {
			if (!Breakpoints[File.Hash]) {
				Breakpoints[File.Hash] = {};
			}

			if (!Breakpoints[File.Hash][Type]) {
				Breakpoints[File.Hash][Type] = {};
			}
			
			if (Add) {
				if (File.ScriptIds[Type]) { 
					for (ScriptId in File.ScriptIds[Type]) {
						Id 	= GetCallId();
						
						if (!NoCallback) {
							CallbackByCallId[Id] = {
								Func:	function(Result) {								
											NppAddMarker(LineNr-1, NPP.MARKER_BREAK);
					
											Breakpoints[File.Hash][arguments[1].Type][LineNr] = Result.breakpointId;
							
											ShowFiles();
										}
										,
								Data:	{Type: Type}
							}
						}
	
						//WsSend('Chrome', '{"method": "Debugger.setBreakpointByUrl", "id": ' + Id + ', "params": {"lineNumber": ' + (LineNr-1) + ', "url": "' + File.Url + '", "condition": "", "columnNumber": 0}}');
						WsSend(Type, '{"method": "Debugger.setBreakpoint", "id": ' + Id + ', "params": {"location":{"scriptId": "' + ScriptId + '","lineNumber": ' + (LineNr-1) + ', "columnNumber": 0}, "condition": ""}}');
					}
				}
			} else {
				for (Type in Breakpoints[File.Hash]) {
					if (Breakpoints[File.Hash][Type][LineNr]) {
						Id 	= GetCallId();
						
						if (!NoCallback) {
							CallbackByCallId[Id] = {
								Func:	function(Result) {
											NppDeleteMarker(LineNr-1, NPP.MARKER_BREAK);

											delete Breakpoints[File.Hash][arguments[1].Type][LineNr];
								
											ShowFiles();
										}
										,
								Data:	{Type: Type}
							}
						}
						
						WsSend(Type, '{"method": "Debugger.removeBreakpoint", "id": ' + Id + ', "params": {"breakpointId": "' + Breakpoints[File.Hash][Type][LineNr] + '"}}');
					}
				}
			}
		}
	}
}

function HitBreakpoint(Type, Params /*optional*/) {
	var LineNr, File;
	
	if (Params) {
		ActiveTypes[Type] = Params;
	} else {
		Params = ActiveTypes[Type];
	}
	
	LineNr	= Params.callFrames[0].location.lineNumber;
	File	= GetFileByScriptId(Type, Params.callFrames[0].location.scriptId);

	$('#activetype').val(Type);
	
	CurrentBreakpoint = Params;
	
	if (File) {
		$('#debugger_inactive').css('display', 'none');
		$('#debugger_active').css('display', 'block');
		
		NppActivateDoc(File.Hash);
		NppSetCaretLineBack(0xff0000);
		NppGotoLine(LineNr + 1);
		NppAddMarker(LineNr, NPP.MARKER_CURRENT_POS);

		CurrentDebugFile = NppGetCurrentFile();
		
		SelectTab('watch');
	} else {
		Resume();
	}
	
	GetScopeVars(Type, 0);
}

function GetScopeVars(Type, CallFrameIndex) {
	var Index1, Index2, CallFrame, Scope, FileInfo, File;
	
	$('#watchresult').html('');
	
	if (CurrentBreakpoint) {
		for (Index1 in CurrentBreakpoint.callFrames) {
			CallFrame = CurrentBreakpoint.callFrames[Index1];
		
			for (Index2 in CallFrame.scopeChain) {
				Scope = CallFrame.scopeChain[Index2];
				
				if (Scope.type == 'local') {
					FileInfo = '<span>&nbsp;</span>';
					
					File = GetFileByScriptId(Type, CallFrame.location.scriptId);

					if (File) {
						FileInfo = '<span style="position: relative; left: 20px; color: gray; cursor: pointer;" onclick="GoToLine(\'' + File.Hash + '\', ' + (CallFrame.location.lineNumber + 1) + ')">(' + File.Url.replace(ChromeUrl, '') + ':' + (CallFrame.location.lineNumber + 1) + ')</span>';
					}

					Text = '';
					
					if (CallFrame.this && CallFrame.this.objectId) {
						Text = '<span style="cursor: pointer; " onclick=\'GetProperties("' + Type + '", JSON.stringify(\"' + CallFrame.this.objectId.replaceAll('"', '\\"') +  '\"))\'>' + CallFrame.this.description + '</span>.';
					} else {
						if (CallFrame.this.description) {
							Text = CallFrame.this.description + '.';
						}
					}
					
					Text += '<span style="text-decoration: underline; cursor: pointer; " onclick=\'($(this).next().next().css("display") == "none") ? GetProperties("' + Type + '", JSON.stringify(\"' + Scope.object.objectId.replaceAll('"', '\\"') +  '\"), true, $(this).next().next()) : $(this).next().next().css("display", "none")\'>' + Scope.name + '</span>' + FileInfo + '<div name="scopechain:' + Index1 + ':' + Index2 + '" style="position: relative; left: 50px; display: none;">&nbsp;</div><br />';
					
					$('#watchresult').append(Text);

					if (Index1 == 0) {				
						GetProperties(Type, JSON.stringify(Scope.object.objectId), true, $('#watchresult').find('div[name="scopechain:' + Index1 + ':' + Index2 + '"]'));
					}
				}
			}
		}
	}
}

function GetProperties(Type, ObjectId, ClearEvalString, AppendTo) {
	var Id = GetCallId();

	if (ClearEvalString) {
		$('#evaluatestring').val('');
	}
	
	if (!AppendTo) {
		AppendTo = $('#watchresult');
	}
	
	AppendTo.css('display', 'block');
	
	CallbackByCallId[Id] = {
		Func:	function(Result) {								
					ReceiveProperties(arguments[1].Type, Result, AppendTo);
				}
				,
		Data:	{Type: Type}
	}
	
	WsSend(Type, '{"params": {"ownProperties": true, "objectId": ' + ObjectId + '}, "method": "Runtime.getProperties", "id": ' + Id + '}');	
}

function ReceiveProperties(Type, Result, AppendTo) {
	var Index, Item, Text, Value, Name,
	NameIndex	= {},
	NameSort 	= [];
	
	AppendTo.html('');
	
	for (Index in Result.result) {
		Item = Result.result[Index];
	
		if (Item.value) {
			NameSort.push('n' + Item.name);
			NameIndex['n' + Item.name] = Index;
		}
	}
	
	for (Index in NameSort.sort()) {
		Item = Result.result[NameIndex[NameSort[Index]]];
		
		if (Item.value.type == 'object' && Item.value.objectId) {
			Text = '<span class="SelectedLine" style="text-decoration: underline; cursor: pointer; " onclick=\'($(this).next().css("display") == "none") ? GetProperties("' + Type + '", JSON.stringify(\"' + Item.value.objectId.replaceAll('"', '\\"') +  '\"), true, $(this).next()) : $(this).next().css("display", "none")\'>' + Item.name + '<span style="position: absolute; left: 300px; color: gray;">' + Item.value.className + '</span></span><div style="position: relative; left: 50px; display: none;">&nbsp;</div><br />';
		} else {
			if (Item.value.type == 'function') {
				Value = Item.value.description;
			} else {
				Value = Item.value.value;
			}
			
			Text = '<div class="SelectedLine" style="width: 800px;">' + Item.name + '<span style="position: absolute; left: 300px; color: gray;">' + Item.value.type + '</span><span style="position: absolute; display: inline-block; left: 370px; color: green; width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + Value + '</span></div>';
		}
		
		AppendTo.append( Text);
	}		
}

function Pause() {
	WsSend($('#activetype').val(), '{"method": "Debugger.pause", "id": ' + GetCallId() + ', "params": {}}');
}

function Resume() {
	var Type = $('#activetype').val();
	
	CleanUpDebugStep();

	$('#debugger_inactive').css('display', 'block');
	$('#debugger_active').css('display', 'none');
	$('#watchresult').html('&nbsp;');
	
	WsSend(Type, '{"method": "Debugger.resume", "id": ' + GetCallId() + ', "params": {}}');
	
	ActiveTypes[Type] = true;
}

function StepInto() {
	CleanUpDebugStep();

	WsSend($('#activetype').val(), '{"method": "Debugger.stepInto", "id": ' + GetCallId() + ', "params": {}}');
}

function StepOver() {
	CleanUpDebugStep();

	WsSend($('#activetype').val(), '{"method": "Debugger.stepOver", "id": ' + GetCallId() + ', "params": {}}');
}

function StepOut() {
	CleanUpDebugStep();

	WsSend($('#activetype').val(), '{"method": "Debugger.stepOut", "id": ' + GetCallId() + ', "params": {}}');
}

function Evaluate(Expression) {
	//{"id":3,"result":{"result":{"type":"object","subtype":"node","className":"HTMLDocument","description":"#document","objectId":"{\"injectedScriptId\":1,\"id\":1}"},"wasThrown":false}}
	var Id	= GetCallId(),
	Type	= $('#activetype').val();
		
	CallbackByCallId[Id] = {
		Func:	function(Result) {								
					if (Result.result && Result.result.objectId) {
						GetProperties(arguments[1].Type, JSON.stringify(Result.result.objectId));
					}
				}
				,
		Data:	{Type: Type}
	}
	
	Expression = JSON.stringify(Expression);
			
	WsSend(Type, '{"method":"Runtime.evaluate","params":{"expression":' + Expression + ',"objectGroup":"console","includeCommandLineAPI":true,"doNotPauseOnExceptions":false,"returnByValue":false},"id":' + Id + '}');
}

function SetScriptSource(File) {
	var ScriptId, Id, Type,
	Content = JSON.stringify(FileGetContents(File.FilePath, true));

	for (Type in File.ScriptIds) {
		for (ScriptId in File.ScriptIds[Type]) {
			Id = GetCallId();
		
			WsSend(Type, '{"method": "Debugger.setScriptSource","id": ' + Id + ',"params": {"scriptSource": ' + Content + ',"scriptId": "' + ScriptId + '"}}');
		}
	}
}

// Tmp

function ReplaceConst() {
	var i, Hash, Content, Md1, Md2,
	Replace = [
		'WINDOW_MODE',
		'VIEW_MODE',
		'COMPONENT_MODE',
		'UNDO_MODE',
		'EVENT_HANDLER',
		'DESIGN_COLORS',
		'COMPONENT_TYPE',
		'PROP_TYPE',
		'DIRTY_TYPE',
		'LOG_LEVEL',
		'CONNECTION_STATUS',
		'LIBRARY_EXEC_STATUS',
		'LIBRARY_ARGUMENT_TYPE',
		'VARIABLE_DEPENDENCY_TYPE',
		'ADD_DESIGNCLASS_OFFSET',
		'UNDO_RECORDING_MAX_ACTIONS',
		'GARBAGE_COLLECT_INTERVAL'
	];
	
	for (Hash in AppFiles) {
		Content = FileGetContents(AppFiles[Hash].FilePath, true);
		
		Md1 = GetHash(Content);
		
		for (i in Replace) {
			Content = Content.replaceAll(Replace[i], 'CONST.' + Replace[i]);
		}
		
		Md2 = GetHash(Content);
		
		if (Md1 != Md2) {
			FilePutContents(AppFiles[Hash].FilePath, Content, false, true);
		}
	}
}	
