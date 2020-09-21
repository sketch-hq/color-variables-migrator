const sketch = require('sketch')
const Swatch = sketch.Swatch
const doc = sketch.getSelectedDocument()

export function migrateColors(context){
  // When you open an existing document in Sketch 69, the color assets in the document will be migrated to Color Swatches. However, layers using those colors will not be changed to use the new swatches. This plugin takes care of this
  // But first, ask the user for confirmation!
  // TODO: make a proper confirmation dialog for this thing,
  // and maybe add it to the API
  sketch.UI.getInputFromUser(
    "Replace existing colors with Color Variables?",
    {
      initialValue: 'Yes',
    },
    (err, value) => {
      if (err) {
        // most likely the user canceled the input
        return
      } else {
        const doc = sketch.getSelectedDocument()
        let swatches = doc.swatches
        if (swatches.length == 0) {
          // Nothing to see here, move along
          return
        }

        const allLayers = sketch.find('*') // we can use something else if we don't want to bring Sketch down... Try with larger sample docs and see what happens...
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
          // TODO: do the same with borders!
        })
      }
    }
  )
}

export function migrateStyles(context) {
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

export function convertStyles(context) {
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
