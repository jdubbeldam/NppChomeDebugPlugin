NppChromeDebugPlugin
====================
A simple Notepad++ plugin for debugging javascripts in web and NodeJs applications using the Chrome Debugging Protocol.

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
Use Alt+d to start the plugin. In the 'Config' tab choose the path to your web application
in 'Client application directory', fill in the correct 'Client application directory' and activate the 'Client application directory' checkbox. Click on the 'Restart plugin'
button in the right corner (![alt tag](https://github.com/jdubbeldam/NppChomeDebugPlugin/blob/master/images/refresh.png)). Open the appropriate javascript file, go to your line of choice and press Alt+b to place a
breakpoint.

![alt tag](https://github.com/jdubbeldam/NppChomeDebugPlugin/blob/master/images/config.png)

Prerequisite
============

* Internet Explorer 10 or higher (tested with IE11)
* Recent version of Chrome (tested with 53.0.2785.143)
* Nightly build version of Nodejs (tested with v7.0.0-nightly201609202b5acda7a2)


jan-willem.dubbeldam@kropman.nl