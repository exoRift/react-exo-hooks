import { Window } from 'happy-dom'

const dom = new Window()

globalThis.window = dom as unknown as Window & typeof globalThis.window
globalThis.document = dom.document as unknown as Document
globalThis.navigator = dom.navigator as unknown as Navigator

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 0) as unknown as number

globalThis.cancelAnimationFrame = (id: number) => {
  clearTimeout(id)
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!globalThis.confirm) {
  globalThis.confirm = () => true
}
