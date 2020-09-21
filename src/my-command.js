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
    height: 280,
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
  const useColorSwatchesInLayers = options['option-1']
  const useColorSwatchesInStyles = options['option-2']

  if (!useColorSwatchesInLayers && !useColorSwatchesInStyles) {
    // Yo, you know there's a Cancel button for this, right?
    cancel()
  }
  if (useColorSwatchesInLayers) {
    doUseColorSwatchesInLayers()
  }
  if (useColorSwatchesInStyles) {
    doUseColorSwatchesInStyles()
  }
  UI.message('Color migration complete.')
}

function doUseColorSwatchesInLayers(context){
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

function doUseColorSwatchesInStyles(context) {
  // This method traverses all Layer and Text Styles, and makes sure they use Color Swatches that exist in the document.

  const allLayerStyles = doc.sharedLayerStyles
  allLayerStyles.forEach( style => {
    const currentStyle = style.style
    currentStyle.fills.concat(currentStyle.borders).forEach( item => {
      if (item.fillType == 'Color') {
        const swatch = matchingSwatchForColor(item.color)
        if (swatch) {
          item.color = swatch.referencingColor
        }
      }
    })
    // TODO: This should also work with gradients...
  })

  const allTextStyles = doc.sharedTextStyles
  allTextStyles.forEach( style => {
    const currentStyle = style.style
    console.log(`Finding matching swatch for ${currentStyle}`);
    const swatch = matchingSwatchForColor(currentStyle.textColor)
    console.log(swatch)
    if (swatch) {
      console.log(`Assigning swatch to text style`);
      const newColor = swatch.referencingColor
      //console.log('yo: ' + newColor.toMSImmutableColor())
      currentStyle.textColor = newColor
      console.log('---------------------------------------------------');
    }
  })
}

function matchingSwatchForColor(color, name) {
  console.log('matchingSwatchForColor: ' + color);
  // We need to match color *and* name, if we want this to work
  let swatches = sketch.getSelectedDocument().swatches
  let matchingSwatches = swatches.filter(swatch => swatch.color == color)
  console.log(matchingSwatches.length)
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
