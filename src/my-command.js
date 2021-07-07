import sketch from 'sketch'
import BrowserWindow from 'sketch-module-web-view'
import { getWebview } from 'sketch-module-web-view/remote'
import UI from 'sketch/ui'

const Swatch = sketch.Swatch
const doc = sketch.getSelectedDocument()
const webviewIdentifier = 'color-variables-migrator.webview'

const automatedPrefix = "Auto-generated/";
const ItemType = {
  shape: 'shape',
  text: 'text',
  layerStyle: 'layerstyle',
  textStyle: 'textstyle'
}

export function migrate(context) {
  const options = {
    identifier: webviewIdentifier,
    width: 400,
    height: 300,
    show: false,
    resizable: false,
    title: 'Color Variables Migrator',
    minimizable: false,
    maximizable: false,
    backgroundColor: '#ececec',
    hidesOnDeactivate: false,
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
  const createColorSwatches = options['option-3']

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
  if (createColorSwatches) {
    createMissingSwatches()
  }

  UI.message('Color migration complete.')
}

function doUseColorSwatchesInLayers(context) {
  // When you open an existing document in Sketch 69, the color assets in the document will be migrated to Color Swatches. However, layers using those colors will not be changed to use the new swatches. This plugin takes care of this
  const allLayers = sketch.find('*') // TODO: optimise this query: ShapePath, SymbolMaster, Text, SymbolInstance
  allLayers.forEach(layer => {
    layer.style.fills
      .concat(layer.style.borders)
      .filter(item => item.fillType == 'Color')
      .forEach(item => {
        const layerColor = item.color
        let swatch = matchingSwatchForColor(layerColor)
        if (!swatch) {
          return
        }
        item.color = swatch.referencingColor
      })
    // Previous actions don't work for Text Layer colors that are colored using TextColor, so let's fix that:
    if (layer.style.textColor) {
      const layerColor = layer.style.textColor
      let swatch = matchingSwatchForColor(layerColor)
      if (!swatch) {
        return
      }
      layer.style.textColor = swatch.referencingColor
    }
  })
}

function doUseColorSwatchesInStyles(context) {
  // This method traverses all Layer and Text Styles, and makes sure they use Color Swatches that exist in the document.
  const stylesCanBeUpdated = []

  const allLayerStyles = doc.sharedLayerStyles
  allLayerStyles.forEach(style => {
    style.getAllInstances().forEach(styleInstance => {
      if (!styleInstance.isOutOfSyncWithSharedStyle(style)) {
        stylesCanBeUpdated.push({ instance: styleInstance, style: style })
      }
    })
    style.style.fills.concat(style.style.borders).forEach(item => {
      if (item.fillType == 'Color') {
        const swatch = matchingSwatchForColor(item.color)
        if (swatch) {
          item.color = swatch.referencingColor
        }
      }
    })
    // TODO: This could also work with gradients...
  })

  const allTextStyles = doc.sharedTextStyles
  allTextStyles.forEach(style => {
    style.getAllInstances().forEach(styleInstance => {
      if (!styleInstance.isOutOfSyncWithSharedStyle(style)) {
        stylesCanBeUpdated.push({ instance: styleInstance, style: style })
      }
    })
    const currentStyle = style.style
    const swatch = matchingSwatchForColor(currentStyle.textColor)
    if (swatch) {
      currentStyle.textColor = swatch.referencingColor
    }
  })
  // Finally, update all layers that use a style we updated...
  stylesCanBeUpdated.forEach(pair => {
    pair.instance.syncWithSharedStyle(pair.style)
  })
}


function createMissingSwatches(context) {
  const currentSwatches = new Map()
  const missingSwatches = new Map()

  doc.swatches.forEach(function (swatch) {
    currentSwatches.set(swatch.color, swatch);
  });

  const allLayers = sketch.find('*') // TODO: optimise this query: ShapePath, SymbolMaster, Text, SymbolInstance
  const updatedLayersMap = new Map();
  allLayers.forEach(layer => {
    layer.style.fills
      .concat(layer.style.borders)
      .filter(item => item.fillType == 'Color')
      .forEach(item => {
        if (!currentSwatches.has(item.color)) {
          var elementToUpdate = {
            "layer": layer,
            "item": item,
            "type": ItemType.shape
          }
          if (!missingSwatches.has(item.color)) {
            var elementsToUpdate = []
            elementsToUpdate.push(elementToUpdate)
            missingSwatches.set(item.color, elementsToUpdate);
          }
          else {
            var elementsToUpdate = missingSwatches.get(item.color);
            elementsToUpdate.push(elementToUpdate)
          }
        }
      })
    if (layer.style.textColor) {
      if (!currentSwatches.has(layer.style.textColor)) {
        var elementToUpdate = {
          "layer": layer,
          "type": ItemType.text
        }
        if (!missingSwatches.has(layer.style.textColor)) {
          var elementsToUpdate = [];
          elementsToUpdate.push(elementToUpdate)
          missingSwatches.set(layer.style.textColor, elementsToUpdate);
        }
        else {
          var elementsToUpdate = missingSwatches.get(layer.style.textColor);
          elementsToUpdate.push(elementToUpdate)
        }
      }
    }
  })


  const allLayerStyles = doc.sharedLayerStyles;
  const updatedStylesMap = new Map()
  allLayerStyles.forEach(style => {
    style.style.fills.concat(style.style.borders).forEach(item => {
      if (item.fillType == 'Color') {
        if (!currentSwatches.has(item.color)) {
          var elementToUpdate = {
            "style": style,
            "item": item,
            "type": ItemType.layerStyle
          }
          if (!missingSwatches.has(item.color)) {
            var elementsToUpdate = []
            elementsToUpdate.push(elementToUpdate)
            missingSwatches.set(item.color, elementsToUpdate)
          }
          else {
            var elementsToUpdate = missingSwatches.get(item.color)
            elementsToUpdate.push(elementToUpdate)
          }
        }
      }
    })
  })

  const allTextStyles = doc.sharedTextStyles
  allTextStyles.forEach(style => {
    if (!currentSwatches.has(style.style.textColor)) {
      var elementToUpdate = {
        "style": style,
        "type": ItemType.textStyle
      }
      if (!missingSwatches.has(style.style.textColor)) {
        var elementsToUpdate = []
        elementsToUpdate.push(elementToUpdate)
        missingSwatches.set(style.style.textColor, elementsToUpdate)
      }
      else {
        var elementsToUpdate = missingSwatches.get(style.style.textColor)
        elementsToUpdate.push(elementToUpdate)
      }
    }
  })


  missingSwatches.forEach(function (value, key) {

    doc.swatches.push(sketch.Swatch.from({
      name: automatedPrefix + key,
      color: key.toString()
    }));

    value.forEach(function (elementToUpdate) {
      switch (elementToUpdate.type) {
        case ItemType.shape:
          elementToUpdate.item.color = doc.swatches[doc.swatches.length - 1].referencingColor;
          if (!updatedLayersMap.has(elementToUpdate.layer)) updatedLayersMap.set(elementToUpdate.layer, true);
          break;
        case ItemType.text:
          elementToUpdate.layer.style.textColor = doc.swatches[doc.swatches.length - 1].referencingColor;
          if (!updatedLayersMap.has(elementToUpdate.layer)) updatedLayersMap.set(elementToUpdate.layer, true);
          break;
        case ItemType.layerStyle:
          elementToUpdate.item.color = doc.swatches[doc.swatches.length - 1].referencingColor;
          if (!updatedStylesMap.has(elementToUpdate.style)) updatedStylesMap.set(elementToUpdate.style, true);
          break;
        case ItemType.textStyle:
          elementToUpdate.style.style.textColor = doc.swatches[doc.swatches.length - 1].referencingColor;
          if (!updatedStylesMap.has(elementToUpdate.style)) updatedStylesMap.set(elementToUpdate.style, true);
          break;
      }
    });
  });
}

function matchingSwatchForColor(color, name) {
  // We need to match color *and* name, if we want this to work
  const swatches = sketch.getSelectedDocument().swatches
  const matchingSwatches = swatches.filter(swatch => swatch.color === color)
  if (matchingSwatches.length == 0) {
    return null
  }
  if (matchingSwatches.length == 1) {
    return matchingSwatches[0]
  }
  // This means there are multiple swatches matching the color. We'll see if we can find one that also matches the name. If we don't find one, or there is no name provided, return the first match.
  if (name) {
    const swatchesMatchingName = matchingSwatches.filter(
      swatch => swatch.name === name
    )
    if (swatchesMatchingName.length) {
      return swatchesMatchingName[0]
    } else {
      return matchingSwatches[0]
    }
  } else {
    return matchingSwatches[0]
  }
}

function colorVariableFromColor(color) {
  let swatch = matchingSwatchForColor(color)
  return swatch.referencingColor
}
