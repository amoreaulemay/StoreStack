import * as mod from '../index'
import {nanoid} from 'nanoid'

// Mark: Test Custom Errors
test('Testing DuplicateObserverError', () => {
  const error = new mod.DuplicateObserverError()

  expect(error).toBeInstanceOf(mod.DuplicateObserverError)
  expect(error.message).toBe('This observer is already attached to the store.')
})

test('Testing UnknownObserverError', () => {
  const error = new mod.UnknownObserverError()

  expect(error).toBeInstanceOf(mod.UnknownObserverError)
  expect(error.message).toBe('Attempted removal of unattached observer.')
})

test('Testing MemoryAllocationError', () => {
  const error = new mod.MemoryAllocationError()

  expect(error).toBeInstanceOf(mod.MemoryAllocationError)
  expect(error.message).toBe('Attempted to insert store at already allocated memory address without explicit override.')
})

test('Testing NullPointerError', () => {
  const error = new mod.NullPointerError()

  expect(error).toBeInstanceOf(mod.NullPointerError)
  expect(error.message).toBe('Attempted to access unallocated memory address.')
})

// Mark: Testing setup
test('The StoreStack should be able to be instantiated', () => {
  const Stores = mod.StoreStack.attach()

  expect(Stores).toBeInstanceOf(mod.StoreStack)
})

test('window.stores should be of instance StoreStack when importing mod.ts', () => {
  expect(window.stores).toBeInstanceOf(mod.StoreStack)
})

// Mark: Testing creating a new store
test('A new Store can be created', () => {
  const state = 'Test'
  const store = new mod.Store(state)

  expect(store).toBeInstanceOf(mod.Store)
  expect(store.state).toBe(state)
})

test('A store can generate a pointer', () => {
  const pointer = mod.Store.newPointer()

  expect(typeof pointer).toBe('string')
})

test('A new observer can be created', () => {
  class ConcreteObserver implements mod.Observer<void> {
    public update(_subject: mod.Store<void>): void {
      return
    }
  }

  const observer = new ConcreteObserver()

  expect(observer).toBeInstanceOf(ConcreteObserver)
})

test('A store can attach and trigger an observer', () => {
  let output = ''
  const expectedResult = 'Test'

  class ConcreteObserver implements mod.Observer<string> {
    public update(subject: mod.Store<string>): void {
      output = subject.state
    }
  }

  const store = new mod.Store(output)
  store.attach(new ConcreteObserver())

  expect(store.state).toEqual(output)
  expect(output).not.toEqual(expectedResult)

  store.set(expectedResult)

  expect(store.state).toEqual(expectedResult)
  expect(output).toEqual(expectedResult)
})

test('A store can detach an observer', () => {
  let output = ''
  const expectedResult1 = 'Test'
  const expectedResult2 = 'Test 2'

  class ConcreteObserver implements mod.Observer<string> {
    public update(subject: mod.Store<string>): void {
      output = subject.state
    }
  }

  const observer = new ConcreteObserver()
  const store = new mod.Store(output)
  store.attach(observer)

  expect(store.state).toEqual(output)
  expect(output).not.toEqual(expectedResult1)
  expect(output).not.toEqual(expectedResult2)

  store.set(expectedResult1)

  expect(store.state).toEqual(expectedResult1)
  expect(output).toEqual(expectedResult1)

  store.detach(observer)
  store.set(expectedResult2)

  expect(store.state).toEqual(expectedResult2)
  expect(output).not.toEqual(expectedResult2)
})

test('set can reuse a previous state to modify it', () => {
  const output = 0
  const store = new mod.Store(output)

  expect(store.state).toEqual(output)

  store.set((prevState) => prevState + 1)

  expect(store.state).toEqual(output + 1)
})

test('An observer can be attached only once', () => {
  class ConcreteObserver implements mod.Observer<number> {
    public update(_subject: mod.Store<number>): void {
      return
    }
  }

  const store = new mod.Store(0)
  const observer = new ConcreteObserver()

  store.attach(observer)
  expect(() => store.attach(observer)).toThrow(mod.DuplicateObserverError)

  // But can be silently ignored
  expect(() => store.attach(observer, true)).not.toThrow(mod.DuplicateObserverError)
})

test('An unattached observer cannot be removed', () => {
  class ConcreteObserver implements mod.Observer<number> {
    public update(_subject: mod.Store<number>): void {
      return
    }
  }

  const store = new mod.Store(0)
  const observer = new ConcreteObserver()

  expect(() => store.detach(observer)).toThrow(mod.UnknownObserverError)
})

// Mark: StoreStack tests
test('An instance of StoreStack can be instantiated', () => {
  const stack = mod.StoreStack.attach() as unknown

  expect(stack).toBeInstanceOf(mod.StoreStack)
})

test('A store can be added to a stack without providing a pointer, accessed with the returned pointer and can be removed', () => {
  const stack = mod.StoreStack.attach()

  const store = new mod.Store(0)
  const ptr = stack.addStore(store)

  const store2 = new mod.Store(1)

  expect(ptr).not.toBeUndefined()
  expect(stack.get<number>(ptr)).not.toBeUndefined()
  expect(stack.get<number>(ptr)!.state).toEqual(store.state)

  // Cannot be added twice at address without override
  expect(() => stack.addStoreAtPointer(store, ptr, {verbose: true})).toThrow(mod.MemoryAllocationError)

  // Can be overridden
  stack.addStoreAtPointer(store2, ptr, {override: true})

  expect(stack.get<number>(ptr)).not.toBeUndefined()
  expect(stack.get<number>(ptr)!.state).toEqual(store2.state)

  stack.removeStore(ptr)

  expect(stack.get(ptr)).toBeUndefined()

  // But cannot be removed twice
  expect(() => stack.removeStore(ptr, {verbose: true})).toThrow(mod.NullPointerError)
})

test('upsert test', () => {
  const stack = mod.StoreStack.attach()

  const pointer1 = nanoid()

  const defaultValue1 = 0
  const defaultValue2 = 1

  class ConcreteObserver implements mod.Observer<number> {
    public update(subject: mod.Store<number>): void {
      observerOutput = subject.state
    }
  }

  const observer = new ConcreteObserver()
  let observerOutput = defaultValue1

  // Pre assertions
  expect(stack.get(pointer1)).toBeUndefined()

  // Creating a store
  stack.upsert(defaultValue1, pointer1)

  expect(stack.get(pointer1)).not.toBeUndefined()
  expect(stack.get(pointer1)!.state).toEqual(defaultValue1)

  stack.upsert(defaultValue2, pointer1)

  expect(stack.get(pointer1)!.state).not.toEqual(defaultValue2)

  // Attaching an observer
  stack.upsert(defaultValue1, pointer1, observer)
  stack.get<number>(pointer1)!.set(defaultValue2)

  expect(observerOutput).toEqual(defaultValue2)

  // Throwing on reattaching observer
  expect(() => stack.upsert(defaultValue1, pointer1, observer)).toThrow(mod.DuplicateObserverError)
})

// Mark: useStore tests
test('useStore without options', () => {
  const stateValue = 'Test'
  const pointer = mod.useStore(stateValue)

  expect(mod.Stores.get(pointer)).not.toBeUndefined()
  expect(mod.Stores.get<string>(pointer)!.state).toEqual(stateValue)
})

test('useStore with callback', () => {
  const startValue = 0
  const finalValue = 1

  let observerOutput = startValue
  const observerCb = (state: number) => (observerOutput = state)

  const pointer = mod.useStore(startValue, {onChange: observerCb})

  mod.Stores.get<number>(pointer)!.set(finalValue)

  expect(observerOutput).toEqual(finalValue)
})

test('useStore with pointer', () => {
  const pointer = nanoid()
  const value = 0

  expect(mod.useStore(value, {pointer: pointer})).toEqual(pointer)
  expect(mod.useStore(value, {pointer: pointer})).toEqual(pointer)

  // with override
  const value2 = 1

  mod.useStore(value2, {pointer: pointer, override: true})

  expect(mod.Stores.get<number>(pointer)!.state).toEqual(value2)

  // Add cb
  const finalValue = 2
  let outputValue = mod.Stores.get<number>(pointer)!.state
  const callback = (state: number) => (outputValue = state)

  mod.useStore(finalValue, {pointer: pointer, onChange: callback})

  expect(outputValue).toEqual(value2)

  mod.Stores.get<number>(pointer)!.set(finalValue)

  expect(outputValue).toEqual(finalValue)

  // Testing duplicate observers
  class ConcreteObserver implements mod.Observer<number> {
    public update(_subject: mod.Store<number>): void {
      return
    }
  }

  const observer = new ConcreteObserver()

  expect(() => {
    mod.useStore(finalValue, {
      pointer: pointer,
      override: true,
      errorHandling: {verbose: true, stopOnError: true},
      observers: [observer, observer], // Duplicate observers
    })
  }).toThrow(mod.DuplicateObserverError)

  expect(() => {
    mod.useStore(finalValue, {
      pointer: pointer,
      override: false,
      errorHandling: {verbose: true, stopOnError: true},
      observers: [observer, observer], // Duplicate observers
    })
  }).toThrow(mod.DuplicateObserverError)
})

test('useObserver hooks', () => {
  const startValue = 0
  const finalValue = 1
  let counter = startValue
  const callback = (prevState: number) => (counter = prevState)
  const observer = mod.useObserver(callback)
  const store = new mod.Store(startValue)

  expect(observer).toBeInstanceOf(mod.StoreObserver)
  expect(store.state).toBe(startValue)
  expect(counter).toBe(startValue)

  store.attach(observer)
  store.set(finalValue)

  expect(store.state).toBe(finalValue)
  expect(counter).toBe(finalValue)

  store.detach(observer)
})

test('useState', () => {
  const startValue = 0
  const finalValue = 1
  let counter = startValue
  const callback = (prevState: number) => (counter = prevState)

  const stack = mod.StoreStack.attach([mod.useObserver(callback)])
  const [value, setter] = stack.useState({pointer: 'test', defaultValue: startValue})

  expect(stack).toBeInstanceOf(mod.StoreStack)
  expect(value()).toBe(startValue)
  expect(counter).toBe(startValue)

  setter(finalValue)

  expect(value()).toBe(finalValue)
  expect(counter).toBe(finalValue)

  setter((prevState) => prevState + 1)

  expect(value()).toBe(finalValue + 1)
  expect(counter).toBe(finalValue + 1)
})

test('misc tests', () => {
  mod.StoreStack.configure()
})
