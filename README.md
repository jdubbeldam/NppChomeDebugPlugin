NppChromeDebugPlugin
====================
A simple Notepad++ plugin for debugging javascripts in web applications using the Chrome Debug Protocol.

![alt tag](https://github.com/jdubbeldam/NppChomeDebugPlugin/blob/master/images/overview.png)

Features
========

* Placing breakpoints
* Debugging javascripts stepping through files and watching variables 
* Direct updating of changes in javascript files without reloading browser
* Search for strings in files
* Console

![alt tag](https://github.com/jdubbeldam/NppChomeDebugPlugin/blob/master/images/console.png)

Usage
=====

Copy the content of the 'plugin' folder to your local 'notepad++\plugins\' folder.
Use Ctrl+d to start the plugin. In the 'Config' tab choose the path to your web application
in 'Application directory' and fill in the correct url. Click on the '(Re)start browser)'
button ( >| on right side). Open the appropriate javascript file and press Ctrl+b to place a
breakpoint.
