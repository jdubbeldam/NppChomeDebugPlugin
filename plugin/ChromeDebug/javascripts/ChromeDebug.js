var
AppFiles			= {},
AppUrl				= '',
AppDir				= '',
AppStart			= true,
Breakpoints			= {},
AppWs				= {},
CallId				= 0,
CallbackByCallId	= {},
CurrentDebugFile	= "",
CurrentBreakpoint	= {},
AppendToLog			= false,
ActiveTabId			= "",
ConsoleLineNr		= 0
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
		
		$('#appdir')
			.val(AppDir)
			.change(
				function() {
					if (!window.external.IsDirectory( $(this).val() )) {
						$(this).val(AppDir);
					}
				}
			)
		;

		$('#appurl')
			.val(AppUrl)
			.change(
				function() {
					if (!window.external.IsUrl( $(this).val() )) {
						$(this).val(AppUrl);
					}
				}
			)
		;			
		
		$('#appstart')
			.attr('checked', AppStart)
			.click(
				function() {
					AppStart = $(this).attr('checked');
				}
			)
		;
		
		$('#restart').click(
			function() {
				$('#console').html('&nbsp;');
				WsClose();
				
				//NppRemoveAllBreakpoints();
				ChromeStart(AppUrl);
			}
		);
		
		$('#startsearch').click(
			function() {
				StartSearch();
			}
		);
		
		$('#startevaluate').click(
			function() {
				ChromeEvaluate($('#evaluatestring').val());
			}
		);
		
		$('#reload').click(
			function() {
				Reload();
			}
		);

		$('#finddirectory').click(
			function() {
				window.external.SelectDirectory($('#appdir').val());
			}
		);
		
		$('#searchstring').on('keypress', function (e) {
			if(e.which === 13){
				StartSearch();
			}
		});
		
		$('#evaluatestring').on('keypress', function (e) {
			if(e.which === 13){
				ChromeEvaluate($('#evaluatestring').val());
			}
		});
		
		NppRemoveAllBreakpoints();

		NppGetOpenedFiles();

		if (AppStart) {
			ChromeStart(AppUrl);
		}
		
		document.focus();
		
		// Nodejs v7 test
		/*
		var AppWs2 = new WebSocket('ws://localhost:9229/node');

		AppWs2.onopen = function (evt) {									
			AppWs2.send('{"method": "Debugger.enable", "id": ' + GetCallId() + ', "params": {}}');
			AppWs2.send('{"method": "Debugger.canSetScriptSource", "id": ' + GetCallId() + ', "params": {}}');
			AppWs2.send('{"method": "Console.enable", "id": ' + GetCallId() + ', "params": {}}');
			
			Expression = 'console.log("Hallo daar")';
			Expression = JSON.stringify(Expression);
			
			AppWs2.send('{"method":"Runtime.evaluate","params":{"expression":' + Expression + ',"objectGroup":"console","includeCommandLineAPI":true,"doNotPauseOnExceptions":false,"returnByValue":false},"id":' + GetCallId() + '}');

		}

		AppWs2.onerror = function (evt) {					
			alert("WebSocket error: " + JSON.stringify(evt));
		};

		AppWs2.onmessage = function (evt) {
			ConsoleLog(evt.data);
		}
		*/
		// End test
	}
);

$(window).unload(
	function() {
		WsClose();
		SaveConfig();
		NppSetCaretLineBack(0);
		ChromeStop();
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
	
		AppDir		= Config.AppDir;
		AppUrl		= Config.AppUrl;
		AppStart	= Config.AppStart;
	}
}

function SaveConfig() {
	var Config = {
		AppUrl 		: AppUrl,
		AppDir 		: AppDir,
		AppStart 	: AppStart
	}

	FilePutContents('config.json', JSON.stringify(Config));
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
							
							if (App.url == AppUrl) {
								AppWs = new WebSocket(App.webSocketDebuggerUrl);

								AppWs.onopen = function (evt) {									
									WsSend('{"method": "Debugger.enable", "id": ' + GetCallId() + ', "params": {}}');
									WsSend('{"method": "Debugger.canSetScriptSource", "id": ' + GetCallId() + ', "params": {}}');
									WsSend('{"method": "Console.enable", "id": ' + GetCallId() + ', "params": {}}');

									// Keep connection alive
									setInterval(
										function() {
											if (AppWs && AppWs.send) { 
												AppWs.send("");
											}
										}
										,
										5000
									);
								}

								AppWs.onerror = function (evt) {					
									//alert("WebSocket error: " + JSON.stringify(evt));
								};

								AppWs.onmessage = function (evt) {
									var Data = JSON.parse(evt.data);

									if (!Data.error) {
										ToLog("\n=== Receive ======================================\n" + evt.data + "\n");
									}

									if (Data.method) {
										switch (Data.method) {
											case 'Debugger.scriptParsed':
												ChromeAddScript(Data.params);

												break;
											case 'Debugger.paused':
												ChromeHitBreakpoint(Data.params);

												break;
											case 'Console.messageAdded':
												ConsoleMessage(Data.params);

												break;
										}
									}

									if (Data.id && Data.result && CallbackByCallId[Data.id]) {
										CallbackByCallId[Data.id](Data.result);

										delete CallbackByCallId[Data.id];
									}
								};

								AppWs.onclose = function() { 
								
								};
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

function StartSearch() {
	ShowFiles($('#searchstring').val(), $('#matchcase').attr('checked') ? true : false);
}

function WsSend(Message) {
	ToLog("\n=== Send ======================================\n" + Message + "\n");
	
	AppWs.send(Message);
}

function WsClose() {
	if (AppWs && AppWs.close) {
		AppWs.close();

		AppWs = null;
	}
}

function SetOpenedFiles() {
	var Index, FilePath, File, Md5, CurrentFiles = {};

	for (Index=0; Index < arguments.length - 1; Index+=2) {
		FilePath = arguments[Index];

		if (FilePath.toLowerCase().indexOf(AppDir.toLowerCase()) > -1) {
			File		= AddFile(FilePath);
			File.Opened	= true;
			Md5			= arguments[Index + 1];
			
			if (Md5 && File.Md5 && Md5 != File.Md5) {
				FileChanged(File);
			}
			
			File.Md5 = Md5;
			
			CurrentFiles[GetHash(FilePath)] = true;
		}
	}

	for (Hash in AppFiles) {
		if (!CurrentFiles[Hash]) {
			AppFiles[Hash].Opened = false;
		}
	}

	ShowFiles();
}

function FileChanged(File) {
	ChromeSetScriptSource(File);
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
			RelPath = File.FilePath.replaceAll(AppDir, "");

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
		var i, Hash, Item,
		NameSort	= [],
		Spaces		= "";

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
					if (Breakpoints[ Hash]) {
						for (LineNr in Breakpoints[Hash]) {
							Info += '&nbsp;&nbsp;<img src="images/breakpoint.bmp" title="Line: ' + LineNr + '" onclick="GoToLine(\'' +  Hash + '\', ' + LineNr + ')" style="cursor: pointer; " />';
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

function GetFileByScriptId(ScriptId) {
	var File = null;

	for (Hash in AppFiles) {
		if (AppFiles[Hash].ScriptIds[ScriptId]) {
			File = AppFiles[Hash];

			break;
		}
	}

	return File;
}

function ToLog(Content) {
	FilePutContents('log.txt', Content, AppendToLog);
	
	if (!AppendToLog) {
		AppendToLog = true;
	}
}

function FilePutContents(FilePath, Content, Append /*=false*/) {
	if (!Append) {
		Append = false;
	}
	
	window.external.FilePutContents(FilePath, Content, Append);
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

function ConsoleMessage(Params) {
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
					Text = '<span style="text-decoration: underline; cursor: pointer; " onclick=\'ChromeGetProperties(JSON.stringify(\"' + Params.message.parameters[0].objectId.replaceAll('"', '\\"') +  '\"), true); SelectTab("watch"); \'>' + Params.message.parameters[0].description + '</span>';
					
					break;	
			}
		} else {
			Text = Params.message.text;
		}
		
		if (Params.message.level == 'error') {
			Text = '<span style="color: red;">' + Text + '</span>';
		}
		
		ConsoleLog(Text, CallFrames);
	}
}

function ConsoleLog(Message, CallFrames /*optional*/) {
	var File, Parts, ScriptId, LineNr, Index, Display,
	Id			= 'consoleline' + ConsoleLineNr,
	FileLineMenu= '',
	FileLine	= '';
	
	if (CallFrames) {
		for (Index in CallFrames) {
			ScriptId= CallFrames[Index].scriptId;
			LineNr	= CallFrames[Index].lineNumber;
			File	= GetFileByScriptId(ScriptId);
			
			if (File) {
				Parts = File.FilePath.split('\\');
				
				if (Index > 0) {
					FileLineMenu += '<li><div style="text-decoration: underline;" onclick="GoToLine(\'' +  File.Hash + '\', ' + LineNr + ')" >' + Parts[Parts.length -1] + ', Line: ' + LineNr + '</div></li>';
				} else {
					FileLine = '<span style="text-decoration: underline; cursor: pointer; position: absolute; background-color: white; text-align: right; right: 40px;"  onclick="GoToLine(\'' +  File.Hash + '\', ' + LineNr + ')" >' + Parts[Parts.length -1] + ', Line: ' + LineNr + '</span>';
					
					if (CallFrames.length > 1) {
						FileLineMenu = '<ul id="' + Id + '" style="position: absolute; border: 0px; width: 15px; right: 20px;" ><li>..<ul style="width: 400px;">';
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

function SetAppDir(Dir) {
	if (Dir.slice(-1) != '\\') {
		Dir += '\\';
	}
	
	AppDir = Dir;
	
	$('#appdir').val(Dir);
}

function SetAppUrl(Url) {
	AppUrl = Url;
	
	$('#appurl').val(Url);
}	

// Npp ==========================================================================================================
var NPP = {
	MARKER_BREAK 		: 3,
	MARKER_CURRENT_POS 	: 4
}

function NppActivateDoc(Hash) {
	var File = AppFiles[Hash];

	if (File.Opened) {
		window.external.NppActivateDoc(File.FilePath);
	} else {
		NppOpenFile(File.FilePath);
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

// Chrome debugger functions https://chromedevtools.github.io/debugger-protocol-viewer/1-1/Debugger/#method-resume

function ChromeStart(Url) {
	window.external.ChromeStart(Url);
}

function ChromeStop() {
	window.external.ChromeStop();
}

function ChromeAddScript(Params) {
	var FilePath, File, LineNr;
	
	if (Params.url) {
		FilePath	= Params.url.split('?')[0].replaceAll(AppUrl, AppDir).replace(new RegExp('/', 'g'), '\\');
		File		= AddFile(FilePath)
		File.Url	= Params.url;
		
		File.ScriptIds[Params.scriptId] = true;
		
		// Reset breakpoints
		for (LineNr in Breakpoints[File.Hash]) {
			ChromeAddRemoveBreakpoint(FilePath, LineNr, true, true);
		}
	}
}

function ChromeAddRemoveBreakpoint(FilePath, LineNr, Add, NoCallback) {
	var Url, Id,
	File = GetFileByPath(FilePath);

	if (File) {
		Id 	= GetCallId();

		if (!Breakpoints[File.Hash]) {
			Breakpoints[File.Hash] = {};
		}

		if (Add) {
			if (!NoCallback) {
				CallbackByCallId[Id] = function(Result) {				
					NppAddMarker(LineNr-1, NPP.MARKER_BREAK);
					Breakpoints[File.Hash][LineNr] = Result.breakpointId;
					
					ShowFiles();
				}
			}
			
			WsSend('{"method": "Debugger.setBreakpointByUrl", "id": ' + Id + ', "params": {"lineNumber": ' + (LineNr-1) + ', "url": "' + File.Url + '", "condition": "", "columnNumber": 0}}');
		} else {
			if (!NoCallback) {
				CallbackByCallId[Id] = function(Result) {
					NppDeleteMarker(LineNr-1, NPP.MARKER_BREAK);

					delete Breakpoints[File.Hash][LineNr];
					
					ShowFiles();
				}
			}
			
			WsSend('{"method": "Debugger.removeBreakpoint", "id": ' + Id + ', "params": {"breakpointId": "' + Breakpoints[File.Hash][LineNr] + '"}}');
		}
	}
}

function ChromeHitBreakpoint(Params) {
	var
	LineNr	= Params.callFrames[0].location.lineNumber,
	File	= GetFileByScriptId(Params.callFrames[0].location.scriptId);

	//ConsoleLog(JSON.stringify(Params));
	
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
		ChromeResume();
	}
	
	ChromeGetScopeVars(0);
}

function ChromeGetScopeVars(CallFrameIndex) {
	var Index1, Index2, CallFrame, Scope, FileInfo, File;
	
	$('#watchresult').html('');
	
	if (CurrentBreakpoint) {
		for (Index1 in CurrentBreakpoint.callFrames) {
			CallFrame = CurrentBreakpoint.callFrames[Index1];
		
			for (Index2 in CallFrame.scopeChain) {
				Scope = CallFrame.scopeChain[Index2];
				
				if (Scope.type == 'local') {
					FileInfo = '<span>&nbsp;</span>';
					
					File = GetFileByScriptId(CallFrame.location.scriptId);
					
					if (File) {
						FileInfo = '<span style="color: gray; cursor: pointer;" onclick="GoToLine(\'' + File.Hash + '\', ' + (CallFrame.location.lineNumber + 1) + ')">' + File.Url.replace(AppUrl, '') + ':' + (CallFrame.location.lineNumber + 1) + '</span>';
					}

					Text = '<span style="display: inline-block; width: 500px;"><span style="cursor: pointer; " onclick=\'ChromeGetProperties(JSON.stringify(\"' + CallFrame.this.objectId.replaceAll('"', '\\"') +  '\"))\'>' + CallFrame.this.description + '</span>.<span style="text-decoration: underline; cursor: pointer; " onclick=\'($(this).next().next().css("display") == "none") ? ChromeGetProperties(JSON.stringify(\"' + Scope.object.objectId.replaceAll('"', '\\"') +  '\"), true, $(this).next().next()) : $(this).next().next().css("display", "none")\'>' + Scope.name + '</span></span>' + FileInfo + '<div name="scopechain:' + Index1 + ':' + Index2 + '" style="position: relative; left: 50px; display: none;">&nbsp;</div><br />';
					
					$('#watchresult').append(Text);

					if (Index1 == 0) {				
						ChromeGetProperties(JSON.stringify(Scope.object.objectId), true, $('#watchresult').find('div[name="scopechain:' + Index1 + ':' + Index2 + '"]'));
					}
				}
			}
		}
	}
}

function ChromeGetProperties(ObjectId, ClearEvalString, AppendTo) {
	var Id = GetCallId();

	if (ClearEvalString) {
		$('#evaluatestring').val('');
	}
	
	if (!AppendTo) {
		AppendTo = $('#watchresult');
	}
	
	AppendTo.css('display', 'block');
	
	CallbackByCallId[Id] =	function(Result) {
		ChromeReceiveProperties(Result, AppendTo);
	}

	WsSend('{"params": {"ownProperties": true, "objectId": ' + ObjectId + '}, "method": "Runtime.getProperties", "id": ' + Id + '}');	
}

function ChromeReceiveProperties(Result, AppendTo) {
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
	
	ConsoleLog(JSON.stringify(NameSort.sort()));
	ConsoleLog(JSON.stringify(NameIndex));
	
	for (Index in NameSort.sort()) {
		Item = Result.result[NameIndex[NameSort[Index]]];
		
		if (Item.value.type == 'object' && Item.value.objectId) {
			Text = '<span class="SelectedLine" style="text-decoration: underline; cursor: pointer; " onclick=\'($(this).next().css("display") == "none") ? ChromeGetProperties(JSON.stringify(\"' + Item.value.objectId.replaceAll('"', '\\"') +  '\"), true, $(this).next()) : $(this).next().css("display", "none")\'>' + Item.name + '<span style="position: absolute; left: 300px; color: gray;">' + Item.value.className + '</span></span><div style="position: relative; left: 50px; display: none;">&nbsp;</div><br />';
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

function ChromePause() {
	WsSend('{"method": "Debugger.pause", "id": ' + GetCallId() + ', "params": {}}');
}

function ChromeResume() {
	CleanUpDebugStep();

	$('#debugger_inactive').css('display', 'block');
	$('#debugger_active').css('display', 'none');
	$('#watchresult').html('&nbsp;');
	
	WsSend('{"method": "Debugger.resume", "id": ' + GetCallId() + ', "params": {}}');
}

function ChromeStepInto() {
	CleanUpDebugStep();

	WsSend('{"method": "Debugger.stepInto", "id": ' + GetCallId() + ', "params": {}}');
}

function ChromeStepOver() {
	CleanUpDebugStep();

	WsSend('{"method": "Debugger.stepOver", "id": ' + GetCallId() + ', "params": {}}');
}

function ChromeStepOut() {
	CleanUpDebugStep();

	WsSend('{"method": "Debugger.stepOut", "id": ' + GetCallId() + ', "params": {}}');
}

function ChromeEvaluate(Expression) {
	//{"id":3,"result":{"result":{"type":"object","subtype":"node","className":"HTMLDocument","description":"#document","objectId":"{\"injectedScriptId\":1,\"id\":1}"},"wasThrown":false}}
	var Id = GetCallId();
	
	CallbackByCallId[Id] = function(Result) {				
		if (Result.result && Result.result.objectId) {
			ChromeGetProperties(JSON.stringify(Result.result.objectId));
		}
	}
	
	Expression = JSON.stringify(Expression);
			
	WsSend('{"method":"Runtime.evaluate","params":{"expression":' + Expression + ',"objectGroup":"console","includeCommandLineAPI":true,"doNotPauseOnExceptions":false,"returnByValue":false},"id":' + Id + '}');
}

function ChromeSetScriptSource(File) {
	var ScriptId, Id,
	Content = JSON.stringify(FileGetContents(File.FilePath, true));

	for (ScriptId in File.ScriptIds) {
		Id = GetCallId();
		
		WsSend('{"method": "Debugger.setScriptSource","id": ' + Id + ',"params": {"scriptSource": ' + Content + ',"scriptId": "' + ScriptId + '"}}');
	}
}	
