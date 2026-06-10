const stripGitEnv = (): void => {
  Object.keys(process.env)
    .filter((key) => key.startsWith('GIT_'))
    .forEach((key) => {
      Reflect.deleteProperty(process.env, key)
    })
}

stripGitEnv()

export { stripGitEnv }
