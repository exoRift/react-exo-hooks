# React exo Hooks
A collection of useful hooks for data structures and logic, designed for efficiency and performance

## useObject
An Object or array. Rerenders on mutation. Will recursively listen on object/array children (not class instances). This functions using proxy references, allowing React to detect reference changes without having to copy the data over and over again.
> [!TIP]
> Force state updates with `forceUpdate()`, the third item of the tuple
```tsx
function Component () {
  const [object, setObject] = useObject({ foo: { bar: 'baz' } })

  useEffect(() => {
    console.log('Object updated!', object)
  }, [object])

  useEffect(() => {
    console.log('Foo updated!', object.foo)
  }, [object.foo])

  return (
    <button onClick={() => { object.foo.bar = 'foobar' }}>CLICK ME</button>
  )
}
```

## useDebouncedState
Debounce state changes with a delay
```tsx
function Component () {
  const [debounced, setState, real] = useDebouncedState('', 300)

  useEffect(() => {
    console.log(`Debounced value: ${debounced}`)
  }, [debounced])

  return (
    <input value={real} onChange={(e) => setState(e.currentTarget.value)} />
  )
}
```

## usePromise
Handle a promise within render behavior
```ts
function Component () {
  const {
    // 'waiting' | 'resolved' | 'rejected'
    state,
    result,
    error
  } = usePromise(() => signedIn && ((abortSignal) -> getUserProfile(abortSignal)))
}
```

## useSet
A Set. Rerenders upon mutation. To listen on changes in hook dependencies, coerce to a numeric type (`+set`)
> [!TIP]
> Force state updates with `set.forceUpdate()`
```tsx
function Component () {
  const set = useSet<string>()

  useEffect(() => {
    console.log('set items:')
    for (const item of set) console.log(item)
  }, [set, +set])

  return (
    <button onClick={() => set.add('foo')}>CLICK ME</button>
  )
}
```

## useMap
A Map. Rerenders upon mutation. To listen on changes in hook dependencies, coerce to a numeric type (`+map`)
> [!TIP]
> Force state updates with `map.forceUpdate()`
```tsx
function Component () {
  const map = useMap<string, number>()

  useEffect(() => {
    console.log('map items:')
    for (const [key, value] of map.entries()) console.log(`[${key}]: ${value}`)
  }, [map, +map])

  return (
    <button onClick={() => map.set('foo', 52)}>CLICK ME</button>
  )
}
```

## useArrayMemo
Memoize changing array references if the contents remain the same
```tsx
function Component ({ array }: { array: string[] }) {
  const memoed = useArrayMemo(array)

  // Only runs if the contents of the array are different
  useEffect(() => {
    console.log('Array updated!', memoed)
  }, [memoed])

  return (
    <button onClick={() => { object.foo.bar = 'foobar' }}>CLICK ME</button>
  )
}
```

## useUnsaved
Prevent user navigation/window closing when there are unsaved changes (NextJS router compatible)
```ts
function Component () {
  const [isUnsaved, setIsUnsaved] = useState(false)

  useUnsaved(isUnsaved)
}
```
