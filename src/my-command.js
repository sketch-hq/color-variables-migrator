import sketch from 'sketch'
import BrowserWindow from 'sketch-module-web-view'
import { getWebview } from 'sketch-module-web-view/remote'
import UI from 'sketch/ui'

const Swatch = sketch.Swatch
const doc = sketch.getSelectedDocument()
const webviewIdentifier = 'color-variables-migrator.webview'

export function migrate(context) {
  const options = {
    identifier: webviewIdentifier,
    width: 400,
    height: 430,
    show: false,
    resizable: false,
    title: 'Color Variables Migrator',
    minimizable: false,
    maximizable: false,
    backgroundColor: '#ececec',
    hidesOnDeactivate: false
  }

  const browserWindow = new BrowserWindow(options)

  browserWindow.once('ready-to-show', () => {
    browserWindow.show()
  })

  const webContents = browserWindow.webContents

  webContents.on('performMigration', options => {
    browserWindow.close()
    performMigration(options)
  })
  webContents.on('cancel', () => {
    browserWindow.close()
    UI.message('Migration cancelled. Nothing was changed in your document.')
  })

  browserWindow.loadURL(require('../resources/dialog.html'))
}

// When the plugin is shutdown by Sketch (for example when the user disable the plugin)
// we need to close the webview if it's open
export function onShutdown() {
  const existingWebview = getWebview(webviewIdentifier)
  if (existingWebview) {
    existingWebview.close()
  }
}

function performMigration(options) {
  const replaceColors = options['option-1']
  const generateColors = options['option-2']
  const simplifyStyles = options['option-3']
  if (!replaceColors && !generateColors && !simplifyStyles) {
    // Yo, you know there's a Cancel button for this, right?
    cancel()
  }
  // We'll first perform this operation, because otherwise the other two may produce unexpected results
  if (simplifyStyles) {
    doSimplifyStyles()
  }
  // Then we want to make sure all our layers are using Color Variables, and not regular colors...
  if (replaceColors) {
    doMigrateColors()
  }
  // ...and only then are we ready to generate new Color Variables from Layer and Text Styles
  if (generateColors) {
    doMigrateStyles()
  }
  UI.message('Color migration complete.')
}

function doMigrateColors(context){
  // When you open an existing document in Sketch 69, the color assets in the document will be migrated to Color Swatches. However, layers using those colors will not be changed to use the new swatches. This plugin takes care of this
  const allLayers = sketch.find('*') // TODO: optimise this query
  allLayers.forEach(layer => {
    layer.style.fills.filter(fill => fill.fillType == 'Color').forEach(fill => {
      const layerColor = fill.color
      let swatch = matchingSwatchForColor(layerColor)
      if (!swatch) {
        return
      }
      let newColor = swatch.referencingColor
      fill.color = newColor
    })
    layer.style.borders.filter(border => border.fillType == 'Color').forEach(border => {
      const layerColor = border.color
      let swatch = matchingSwatchForColor(layerColor)
      if (!swatch) {
        return
      }
      let newColor = swatch.referencingColor
      border.color = newColor
    })
  })
}

function doMigrateStyles(context) {
  // This method traverses all Layer and Text Styles, and makes sure they use Color Swatches that exist in the document.
  // list all layer styles in document
  const allLayerStyles = doc.sharedLayerStyles
  allLayerStyles.forEach( style => {
    style.style.fills.filter(fill => fill.fillType == 'Color').forEach(fill => {
      let swatch = matchingSwatchForColor(color)
      let newColor = swatch.referencingColor
      fill.color = newColor
    })
    // TODO: do the same for borders
    // TODO: what about multiple fills?
    // TODO: honestly, this should also work with gradients...
  })
  // list all text styles in document
  const allTextStyles =  doc.sharedTextStyles
  allTextStyles.forEach( style => {
    let swatch = matchingSwatchForColor(style.style.textColor)
    if (!swatch) {
      // TODO: would be nice to ask the user if they want to create a new Swatch if there's not a match for the color used in the text style...
      return
    }
    let newColor = swatch.referencingColor
    style.style.textColor = newColor
  })
}

function doSimplifyStyles(context) {
  // Prior to Sketch 69's Color Variables, it was common to use Layer and Text Styles with a single color to emulate color tokens. Updating the style would then change all the layer using that style.
  // In Sketch 69, this hack is no longer necessary. This method will convert all Layer and Text Styles that consist of only 1 color to an equivalent Color Variable, assign that Color Variable to all layers that used the original Layer or Text Style, and finally remove the Style.

  // Thinking about this, I guess it makes sense to merge this and migrateStyles
  // I'll keep them separated for the time being, but there will be a lot of code duplication

  /*
    TODO: this breaks layer styles if a layer has a style + another fill color. One way to avoid this is to check if the style is dirty _before_ replacing it with a Swatch. That way, we can either not do it (easiest), or create a new Swatch and assign it after replacing the style with a Swatch (that's probably a project on its own, since we'd need to check _how_ the local attributes differ from those defined on the Layer Style).
    If we decide not to do it, keep a reference to this and generate a report at the end.
    TODO: Generating a report of what we've done at the end sounds like a nice touch for end users.
  */
  const allLayerStyles = doc.sharedLayerStyles
  const stylesToRemove = []
  allLayerStyles.forEach( style => {
    let currentStyle = style.style
    // TODO: I should really be checking for enabled fills here, but this will do by now
    if (currentStyle.fills.length == 1) {
      const swatchName = 'Migrated Styles/' + style.name + '-fill'
      const swatchColor = currentStyle.fills[0].color
      let fillSwatch = matchingSwatchForColor(swatchColor, swatchName)
      if (!fillSwatch) {
        fillSwatch = Swatch.from({
          name: swatchName,
          color: swatchColor
        })
        doc.swatches.push(fillSwatch)
        fillSwatch = matchingSwatchForColor(swatchColor, swatchName)
      }
      currentStyle.fills[0].color = fillSwatch.referencingColor
      style.getAllInstances().forEach(styleInstance => {
        styleInstance.syncWithSharedStyle(style)
      })
      stylesToRemove.push(style)
    }
    if (currentStyle.borders.length == 1) {
      const swatchName = 'Migrated Styles/' + style.name + '-border'
      const swatchColor = currentStyle.borders[0].color
      let borderSwatch = matchingSwatchForColor(swatchColor, swatchName)
      if (!borderSwatch) {
        borderSwatch = Swatch.from({
          name: swatchName,
          color: swatchColor
        })
        doc.swatches.push(borderSwatch)
        borderSwatch = matchingSwatchForColor(swatchColor, swatchName)
      }
      currentStyle.borders[0].color = borderSwatch.referencingColor
      style.getAllInstances().forEach(styleInstance => {
        styleInstance.syncWithSharedStyle(style)
      })
      stylesToRemove.push(style)
    }
  })
  stylesToRemove.forEach( style => {
    doc.sharedLayerStyles = doc.sharedLayerStyles.filter( item => item.id != style.id )
  })
}

function matchingSwatchForColor(color, name) {
  // We need to match color *and* name, if we want this to work
  let swatches = sketch.getSelectedDocument().swatches
  let matchingSwatches = swatches.filter(swatch => swatch.color == color)
  if (matchingSwatches.length == 0) {
    return null
  } else {
    if (name) {
        return matchingSwatches.filter(swatch => swatch.name == name)[0]
    } else {
      return matchingSwatches[0]
    }
  }
}

function colorVariableFromColor(color) {
  let swatch = matchingSwatchForColor(color)
  let newColor = swatch.referencingColor
  return newColor
}
