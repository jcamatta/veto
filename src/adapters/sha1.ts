import { createHash } from 'node:crypto'
import type { HashFn } from '../core/hashing.js'

const sha1: HashFn = (input) =>
  createHash('sha1').update(input, 'utf8').digest('hex')

export { sha1 }
