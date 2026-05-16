import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReaderStore } from './readerStore'

const initialState = useReaderStore.getState()

afterEach(() => {
  useReaderStore.setState(initialState, true)
})

describe('readerStore', () => {
  it('adds purchased books once and reports ownership', () => {
    useReaderStore.getState().addToLibrary('book-1')
    useReaderStore.getState().addToLibrary('book-1')

    expect(useReaderStore.getState().library).toEqual(['book-1'])
    expect(useReaderStore.getState().isOwned('book-1')).toBe(true)
    expect(useReaderStore.getState().isOwned('book-2')).toBe(false)
  })

  it('saves reading progress by story id', () => {
    useReaderStore.getState().saveProgress({
      storyId: 'book-1',
      chapterIdx: 1,
      sceneIdx: 2,
      blockIdx: 3,
      timestamp: 120,
    })

    expect(useReaderStore.getState().getProgress('book-1')).toMatchObject({
      chapterIdx: 1,
      sceneIdx: 2,
      blockIdx: 3,
      timestamp: 120,
    })
  })

  it('creates, finds, and removes bookmarks', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('bookmark-1')
    vi.setSystemTime(new Date('2026-05-16T00:00:00.000Z'))

    const bookmark = useReaderStore.getState().addBookmark({
      storyId: 'book-1',
      chapterIdx: 0,
      sceneIdx: 1,
      blockIdx: 2,
      label: 'Important beat',
    })

    expect(bookmark).toMatchObject({ id: 'bookmark-1', createdAt: '2026-05-16T00:00:00.000Z' })
    expect(useReaderStore.getState().isBookmarked('book-1', 0, 1, 2)).toBe(true)

    useReaderStore.getState().removeBookmark('book-1', 'bookmark-1')

    expect(useReaderStore.getState().getBookmarks('book-1')).toEqual([])
    vi.useRealTimers()
  })

  it('resets playback position when switching active stories', () => {
    useReaderStore.getState().setActiveStory('book-1')
    useReaderStore.getState().setPlaying(true)
    useReaderStore.getState().setCurrentBlock('block-7')

    useReaderStore.getState().setActiveStory('book-2')

    expect(useReaderStore.getState()).toMatchObject({
      activeStoryId: 'book-2',
      isPlaying: false,
      currentBlockId: null,
    })
  })
})
