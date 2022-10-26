declare global {
  interface Window {
    stores: StoreStack
  }
}

import cloneDeep from 'clone-deep'
import {nanoid} from 'nanoid'

// Polyfill for browsers that don't support the native `structuredClone`.
;(() => {
    /* istanbul ignore next */
  if (!('structuredClone' in window)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line no-global-assign
    window.structuredClone = cloneDeep
  }
})()

// Mark: Definition Interfaces
export interface Observer<T> {
  // eslint-disable-next-line no-unused-vars
  update(subject: Store<T>): void
}

export interface Subject<T> {
  readonly state: T

  // eslint-disable-next-line no-unused-vars
  attach(observer: Observer<T>): void

  // eslint-disable-next-line no-unused-vars
  detach(observer: Observer<T>): void

  notify(): void

  // eslint-disable-next-line no-unused-vars
  set(options: T): void

  // eslint-disable-next-line no-unused-vars
  set(options: (prevState: T) => T): void
}

// Mark: Custom Types
/**
 * Convenience type alias for a pointer.
 */
export type Pointer = string

/**
 * Convenience type for `Store` of any type.
 */
// eslint-disable-next-line
export type AnyStore = Store<any>

// Mark: Custom Errors
/**
 * Error that is triggered when a duplicated observer is being attached to a store.
 *
 * @final
 */
export class DuplicateObserverError extends Error {
  constructor() {
    super('This observer is already attached to the store.')
  }
}

/**
 * Error that is triggered when a non-existing/non-attached observer is being detached from a store.
 *
 * @final
 */
export class UnknownObserverError extends Error {
  constructor() {
    super('Attempted removal of unattached observer.')
  }
}

/**
 * Error that is triggered when attempting to insert a store at an address that was already allocated,
 * without explicit override.
 *
 * @final
 */
export class MemoryAllocationError extends Error {
  constructor() {
    super('Attempted to insert store at already allocated memory address without explicit override.')
  }
}

/**
 * Error that is triggered when attempting to access a memory address that is unallocated.
 *
 * @final
 */
export class NullPointerError extends Error {
  constructor() {
    super('Attempted to access unallocated memory address.')
  }
}

// Mark: Store
/**
 * A simple store that follows the Observer pattern.
 */
export class Store<T> implements Subject<T> {
  /**
   * @internal
   * List of all the observers attached to the store.
   */
  #observers: Observer<T>[] = []

  /**
   * @internal
   * The internal representation of state.
   */
  #state: T

  /**
   * A deep copy of the internal state, to prevent referenced objects to be directly mutated.
   *
   * @remarks
   * To mutate the state, use {@link Store.set}.
   */
  public get state(): T {
    return window.structuredClone(this.#state) as T
  }

  /**
   * Convenience method to create a unique pointer.
   *
   * @returns A `Pointer`
   */
  static newPointer(): string {
    return nanoid()
  }

  /**
   * Creates a new `Store` (aka {@link Subject}) that can be subscribed to, or observed for a state change.
   */
  constructor(state: T) {
    this.#state = state
  }

  /**
   * Attaches/subscribes a new {@link Observer} to the store.
   *
   * @param observer Subscribes a new {@link Observer} to the store.
   * @param skipOnExist If method should silently skip duplicate observers
   * @throws {DuplicateObserverError} If the observer has already been attached.
   */
  public attach(observer: Observer<T>, skipOnExist?: boolean): void {
    const isExist = this.#observers.includes(observer)
    if (isExist && !skipOnExist) {
      throw new DuplicateObserverError()
    } else if (isExist && skipOnExist) {
      return
    }

    this.#observers.push(observer)
  }

  /**
   * Detaches/unsubscribes an {@link Observer} from the store.
   *
   * @param observer The `Observer` to remove.
   * @throws {UnknownObserverError} If the observer was non-existent in the store.
   */
  public detach(observer: Observer<T>): void {
    const observerIndex = this.#observers.indexOf(observer)
    if (observerIndex === -1) {
      throw new UnknownObserverError()
    }

    this.#observers.splice(observerIndex, 1)
  }

  /**
   * Notifies all the observers of a change. Will trigger automatically when the state is changed through
   * {@link Store.set}, but it can be forced by calling this method directly.
   */
  public notify(): void {
    for (const observer of this.#observers) {
      observer.update(this)
    }
  }

  /**
   * Method to mutate the internal state. If a value is directly provided, assign the internal state to that value.
   * A function can also be provided to access a dereferenced copy of the previous state.
   *
   * @param options A value, or function to access the previous state.
   */
  // eslint-disable-next-line no-unused-vars
  public set(options: T | ((prevState: T) => T)): void {
    if (typeof options === 'function') {
      // eslint-disable-next-line no-unused-vars
      this.#state = window.structuredClone((options as (prevState: T) => T)(window.structuredClone(this.state) as T)) as T
    } else {
      this.#state = window.structuredClone(options) as T
    }

    this.notify()
  }
}

// Mark: useStore Options

/**
 * The options to create a store.
 */
export interface StoreOptions<T> {
  /**
   * A key or "pointer" to the store location in `window.stores`.
   *
   * ### Remarks
   * If no pointer is provided, it will be automatically generated and the function will return the pointer as a `string`.
   *
   * **@optional**
   */
  pointer?: Pointer

  /**
   * A "free" observer already configured. Will execute the callback when the state change.
   *
   * @optional
   */
  // eslint-disable-next-line no-unused-vars
  onChange?: (state: T) => void

  /**
   * Additional observers that need to be attached to the store.
   *
   * @optional
   */
  observers?: Observer<T>[]

  /**
   * If set to true, will override the store at the pointer's address if it exists.
   *
   * *Has no effect if the address is unallocated.*
   *
   * @default undefined
   * @optional
   */
  override?: boolean

  /**
   * See {@link StoreOptionsErrorHandling}
   */
  errorHandling?: StoreOptionsErrorHandling
}

/**
 * Defines how {@link useStore} should handle errors.
 */
export interface StoreOptionsErrorHandling {
  /**
   * Set to `true` if error messages should be outputted to the console.
   *
   * `verbose` is set to `false` by default.
   */
  verbose?: boolean

  /**
   * By default {@link useStore} will silently ignore errors to allow the program to
   * continue its execution. If `stopOnError` is set to `true`, the function will stop
   * if an error is thrown and will rethrow it.
   */
  stopOnError?: boolean
}

// Mark: useStore
/**
 * Convenience function to create a store. Multiple options can be provided, see {@link StoreOptions}.
 *
 * Unless the `override` option is set to `true`, this function will not override an existing store, it
 * is therefore safe to use to make sure a store is defined in multiple components.
 *
 * **If no pointer is provided, a pointer will be assigned and returned.**
 *
 * ## Example
 *
 * ```ts
 * // 1. Creating a store without any options
 * const store1Ptr = useStore(0);
 * console.log(Stores.get<number>(store1Ptr).state); // Output: 0
 *
 * // 2. Creating a store with options
 * const store2Ptr = nanoid();
 * useStore(0, { pointer: store2Ptr, onChange: (state) => console.log(state), });
 *
 * console.log(Stores.get<number>(store2Ptr).state); // Output: 0
 * Stores.get<number>(store2Ptr).set((prevState) => prevState + 1); // Output: 1
 * ```
 *
 * @throws {DuplicateObserverError} If provided observer(s) is/are already attached to the store or duplicates.
 *
 * @param state The initial state. If the store already exists, it will not overwrite the state unless the `override` option is set to `true`.
 * @param options See {@link StoreOptions}.
 * @returns The {@link Pointer} to the location of the store.
 */
export function useStore<T>(state: T, options?: StoreOptions<T>): Pointer {
  if (typeof options === 'object') {
    // Options are provided

    const pointer = options.pointer ?? nanoid()
    const callback = options.onChange ?? (() => null)
    const observers = options.observers ?? []
    const override = options.override ?? false

    class StoreObserver implements Observer<T> {
      public update(subject: Store<T>): void {
        callback(subject.state)
      }
    }

    observers.push(new StoreObserver())

    if (override) {
      // If a store exists at address, it will be overridden.

      const store = new Store(state)

      for (const observer of observers) {
        try {
          store.attach(observer)
        } catch (error) {
          if (options.errorHandling?.verbose === true) {
            console.error(error)
          }

          if (options.errorHandling?.stopOnError === true) {
            throw error
          }
        }
      }

      Stores.addStoreAtPointer(store, pointer, {override: true})
    } else {
      // If a store exists at address, it will NOT be overridden, but additional observers will be attached to the store.

      try {
        Stores.upsert(state, pointer, ...observers)
      } catch (error) {
        if (options.errorHandling?.verbose === true) {
          console.error(error)
        }

        if (options.errorHandling?.stopOnError === true) {
          throw error
        }
      }
    }

    return pointer
  } else {
    // No options are provided

    return Stores.addStore(new Store(state))
  }
}

/**
 * Simple store observer implementation.
 */
export class StoreObserver<T> implements Observer<T> {
  #callback: (prevState: T) => void
  constructor(callback: (prevState: T) => void) {
    this.#callback = callback
  }

  // eslint-disable-next-line no-unused-vars
  public update(subject: Store<T>): void {
    this.#callback(subject.state)
  }
}

/**
 * Returns a simple observer that calls a callback function when the store has been modified.
 *
 * @param {(prevState: T) => void} callback
 * @return {StoreObserver}
 */
// eslint-disable-next-line no-unused-vars
export function useObserver<T = unknown>(callback: (prevState: T) => void): StoreObserver<T> {
  return new StoreObserver(callback)
}

// Mark: StoreStack

type SetterFunction<T = any> = (prevState: T) => T

/**
 * A multi {@link Store} container.
 */
export class StoreStack {
  /**
   * Checks if the `StoreStack` is instantiated on `window.stores` and creates it if it's not.
   */
  static configure(): void {
    if (typeof window.stores === 'undefined' || !((window.stores as StoreStack | undefined) instanceof StoreStack)) {
      window.stores = new StoreStack()
    }
  }

  /**
   * This method should only be called when the `StoreStack` is instantiated on the component level, and only in really
   * specific circumstances globally when global observers are desirable.
   *
   * #### Example
   * ```ts
   * ...
   * this.state =  StoreStack.attach([useObserver(() => this.requestUpdate())]);
   * ...
   * ```
   *
   * @param globalObservers An array of global observers
   */
  static attach<T>(globalObservers?: Observer<T>[]) {
    return new StoreStack(globalObservers)
  }

  private constructor(globalObservers?: Observer<any>[]) {
    globalObservers && (this.#globalObservers = globalObservers)
  }

  /**
   * @internal
   * Object containing all the stores.
   */
  #stores: Record<Pointer, AnyStore> = {}
  /**
   * @internal
   * Object containing all the observers that should apply globally.
   */
  #globalObservers: Observer<any>[] = []

  /**
   * Adds a store to the memory stack and assigns it a pointer.
   *
   * @param newItem The {@link Store} to be added to the stack.
   * @returns The {@link Pointer} to the allocated memory for the store.
   */
  public addStore(newItem: AnyStore): Pointer {
    const ptr = nanoid()

    this.#stores[ptr] = newItem
    return ptr
  }

  /**
   * Adds a store to the specified {@link Pointer}. If a store already exists at the address, an option can be passed to override it.
   * If `override` is set to `false`, but the `verbose` option is set to true, and the memory is already allocated, the store will **NOT**
   * be overridden, and an error message will output to the console.
   *
   * @param newItem The {@link Store} to be added to the stack.
   * @param pointer The {@link Pointer} to the memory address where the store should be inserted.
   * @param options Defines if a store should be overridden if it exists at the `Pointer` and if a verbose error should be returned if override is set to false.
   *
   * @throws {MemoryAllocationError} If the address is already allocated and `override` isn't set to `true`.
   */
  public addStoreAtPointer(newItem: AnyStore, pointer: Pointer, options?: {override?: boolean; verbose?: boolean}): void {
    if (typeof this.#stores[pointer] !== 'undefined' && !options?.override) {
      if (options?.verbose) {
        console.error('Error: Cannot add store at pointer, address is already allocated.')
      }

      throw new MemoryAllocationError()
    }

    this.#stores[pointer] = newItem
  }

  /**
   * This method makes sure a store if instantiated at the {@link Pointer}'s address.
   * If no store is instantiated, it will create one holding the `defaultValue` provided.
   * Otherwise, it will only attach {@link Observer Observers} if they are provided.
   *
   * @throws {DuplicateObserverError} If observer is duplicate.
   *
   * @param defaultValue A default state value to insert if a new store is created.
   * @param pointer The {@link Pointer} to the memory address.
   * @param observers {@link Observer Observers} to attach to the store.
   */
  public upsert<T>(defaultValue: T, pointer: Pointer, ...observers: Observer<T>[]): void {
    if (typeof this.#stores[pointer] === 'undefined') {
      this.#stores[pointer] = new Store(defaultValue)
    }

    for (const observer of observers) {
      // eslint-disable-next-line no-useless-catch
      try {
        this.#stores[pointer].attach(observer)
      } catch (error) {
        throw error
      }
    }
  }

  /**
   * Removes a store from the memory stack. If the {@link Pointer}'s address is unallocated,
   * it will output an error message to the `console` if `verbose` option is set to true.
   *
   * @param ptr The {@link Pointer}'s address of the store.
   * @param options If the removal fails, should the function verbose it to the console? Defaults to false.
   *
   * @throws {NullPointerError} If attempting to delete a store at unallocated memory address.
   */
  public removeStore(ptr: Pointer, options?: {verbose?: boolean}): void {
    if (typeof this.#stores[ptr] === 'undefined') {
      if (options?.verbose) {
        console.error('Error: The pointer address points to unallocated memory.')
      }

      throw new NullPointerError()
    }

    delete this.#stores[ptr]
  }

  /**
   * Returns a reference to the store at the address if it exists, otherwise undefined. A type can be
   * passed in order to make the return typed.
   *
   * ## Example
   * ```typescript
   * const ptr = useStore(0);
   * console.log(Stores.get<number>(ptr).state); // Output: 0
   * ```
   *
   * @param ptr The {@link Pointer} to the store.
   * @returns The store if it exists
   */
  // eslint-disable-next-line
  public get<T = any>(ptr: Pointer): Store<T> | undefined {
    if (typeof this.#stores[ptr] !== 'undefined') {
      return this.#stores[ptr] as Store<T>
    }

    return undefined
  }

  /**
   * React-like method to use a store with a setter and a getter. This will not override an existing store, but it will
   * update its observers.
   *
   * @param pointer The pointer to the store.
   * @param defaultValue The default value if the store is not instantiated.
   * @param observers Additional observers to attach to the store.
   * @param useGlobalObserver If global observers are enabled.
   */
  public useState<T = any>({pointer, defaultValue, observers, useGlobalObserver}: {pointer: Pointer, defaultValue: T, observers?: Observer<T>[], useGlobalObserver?: boolean}): [() => T, (newState: T | SetterFunction<T>) => void] {
    const concatObservers = (() => {
      let temp: Observer<any>[] = []
      /* istanbul ignore next */
      observers && temp.push(...observers)
      ;(useGlobalObserver as boolean | undefined) !== false && temp.push(...this.#globalObservers)

      return [...temp]
    })()

    if (typeof this.#stores[pointer] === 'undefined') {
      this.#stores[pointer] = new Store(defaultValue)
    }

    concatObservers.forEach(observer => this.#stores[pointer].attach(observer, true))

    const setter = (newState: T | SetterFunction<T>) => {
      if (typeof newState === 'function') {
        return this.#stores[pointer].set((newState as ((prevState: T) => T))(window.structuredClone(this.#stores[pointer].state)))
      } else {
        this.#stores[pointer].set(newState)
      }
    }

    return [() => this.#stores[pointer].state, setter]
  }
}

// Mark: Stores
/**
 * Convenience constant, provide access to the global {@link StoreStack} and creates it if it doesn't exist.
 */
export const Stores: StoreStack = (function () {
  StoreStack.configure()
  return window.stores
})()
