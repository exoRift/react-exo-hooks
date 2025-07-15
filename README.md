# React exo Hooks

## useUnsaved
Prevent user navigation/window closing when there are unsaved changes (NextJS router compatible)
```ts
function Component () {
  const [isUnsaved, setIsUnsaved] = useState(false)

  useUnsaved(isUnsaved)
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
A Set. Rerenders upon mutation. Listen for update signal with `+`
> [!TIP]
> Force state update with `set.forceUpdate()`
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
A Map. Rerenders upon mutation. Listen for update signal with `+`
> [!TIP]
> Force state update with `map.forceUpdate()`
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

## useArray
An Array. Rerenders upon mutation. Listen for update signal with `+`
> [!TIP]
> Force state update with `array.forceUpdate()`
```tsx
function Component () {
  const array = useArray<string>()

  useEffect(() => {
    console.log('array items:', array.join(', '))
  }, [array, +array])

  return (
    <button onClick={() => array.push('foo')}>CLICK ME</button>
  )
}
```

## useObject
An Object. Rerenders on mutation. Will recursively listen on simple children (not class instances).
> [!TIP]
> Force state update with `forceUpdate()`, the third item of the tuple
```tsx
function Component () {
  const [object, setObject] = useObject({ foo: { bar: 'baz' } })

  useEffect(() => {
    console.log('Object updated!', object)
  }, [object, +object])

  return (
    <button onClick={() => { object.foo.bar = 'foobar' }}>CLICK ME</button>
  )
}
```