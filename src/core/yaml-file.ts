const isYamlFile = (name: string): boolean =>
  name.endsWith('.yaml') || name.endsWith('.yml')

export { isYamlFile }
