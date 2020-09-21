# Color Variables Migrator

Sketch 69 introduced Color Variables, a powerful new feature that allows you to reuse colors across your document while maintaining consistency and making updates easy.

When you open a document with pre-69 color swatches, Sketch converts them to Color Variables. Layers using those for fills or borders will be automatically updated to use Color Variables. But it's up to you to migrate Layer and Text Styles, since those usually require some planning to be migrated.

This plugin helps you with that last step, and does three things (you can enable them independently when running the plugin):

- Updates all Layer and Text Styles to use existing Color Variables in the document
- Creates new Color Variables from colors defined in Layer and Text Styles. These will be created in a 'Migrated Styles' group, using the style names
- Replaces Layer and Text Styles that only contain one fill and/or one border with an equivalent Color Variable

Please note: the plugin only works in the currently opened document. If you want to migrate shared Libraries, you'll need to open them first.

## Installation

- [Download](../../releases/latest/download/color-variables-migrator.sketchplugin.zip) the latest release of the plugin
- Un-zip
- Double-click on color-variables-migrator.sketchplugin

## Usage

- Open the Plugins menu, and choose 'Color Variables Migrator'
- The plugin will show a dialog with options. Read carefully, pick your options, and click the 'Migrate' button
