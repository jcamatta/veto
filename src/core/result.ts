type Ok<A> = { readonly _tag: 'Ok'; readonly value: A }

type Err<E> = { readonly _tag: 'Err'; readonly error: E }

type Result<A, E> = Ok<A> | Err<E>

const ok = <A>(value: A): Ok<A> => ({ _tag: 'Ok', value })

const err = <E>(error: E): Err<E> => ({ _tag: 'Err', error })

const isOk = <A, E>(result: Result<A, E>): result is Ok<A> =>
  result._tag === 'Ok'

const isErr = <A, E>(result: Result<A, E>): result is Err<E> =>
  result._tag === 'Err'

const map =
  <A, B>(f: (value: A) => B) =>
  <E>(result: Result<A, E>): Result<B, E> =>
    isOk(result) ? ok(f(result.value)) : result

export { type Result, type Ok, type Err, ok, err, isOk, isErr, map }
