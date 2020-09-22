# Color Variables Migrator

Sketch 69 introduced Color Variables, a powerful new feature that allows you to reuse colors across your document while maintaining consistency and making updates easy.

When you open a document with pre-69 color swatches, Sketch converts them to Color Variables.

But it's up to you to migrate Layers and Styles to use Color Variables, since that usually requires some planning to be migrated.

This plugin helps you with the last step, and does two things (you can enable them independently when running the plugin):

- Updates all Layers to use existing Color Variables in the Document
- Updates all Layer and Text Styles to use existing Color Variables in the Document (NOTE: There is a bug in the Text Styles code and that part is not working at the moment, but I'm working on it)

Please note: the plugin only works in the currently opened document. If you want to migrate shared Libraries, you'll need to open them first.

## Installation

- [Download](../../releases/latest/download/color-variables-migrator.sketchplugin.zip) the latest release of the plugin
- Un-zip
- Double-click on color-variables-migrator.sketchplugin

## Usage

- Open the Plugins menu, and choose 'Color Variables Migrator'
- The plugin will show a dialog with options. Read carefully, pick your options, and click the 'Migrate' button
