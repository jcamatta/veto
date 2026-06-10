const gitKeys = Object.keys(process.env).filter((key) => key.startsWith('GIT_'))

gitKeys.forEach((key) => {
  Reflect.deleteProperty(process.env, key)
})

export { gitKeys }
