// Disable the context menu to have a more native feel
document.addEventListener("contextmenu", e => e.preventDefault())
let allInputs = [];
[
  'option-1',
  'option-2'
].forEach(id => {
  allInputs.push(document.getElementById(id))
})

const getOptions = () => {
  let obj = {}
  allInputs.forEach(input => {
    let val = Number(input.value)

    if (input.type === 'checkbox') {
      val = Boolean(input.checked)
    } else if (input.type === 'text') {
      val = input.value
    }

    obj[input.id] = val
  })

  return obj
}

document.getElementById('cancel').addEventListener('click', function() {
  window.postMessage('cancel')
})
document.getElementById('submit').addEventListener('click', function() {
  window.postMessage('performMigration', getOptions())
})