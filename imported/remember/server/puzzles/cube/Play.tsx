/**
 * Missing Cube. The 3D view uses Three.js, which only loads with this component (it is a lazy chunk), so other days
 * never download it. The layer view (one n x n grid per layer, top to bottom) does the same job with plain buttons,
 * for small screens, keyboards and screen readers, and as a fallback without WebGL.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Done, useDraft, type PlayProps } from '../../web/src/play/kit'
import { cellOf, coords, onSurface, type Answer, type Key, type Params, type Study, type Test } from './index'

type Mark = 'mark' | 'right' | 'wrong' | 'ghost'

interface ViewProps {
  n: number
  /** Cells drawn as solid blocks. */
  solid: Set<number>
  marks: Map<number, Mark>
  colors: string[]
  edge: string
  onTap?(cell: number): void
  reducedMotion: boolean
  onFail(): void
}

const MARK_COLOR: Record<Mark, string> = { mark: '#d9483b', right: '#36a159', wrong: '#d9483b', ghost: '#e8b923' }

function CubeView({ n, solid, marks, colors, edge, onTap, reducedMotion, onFail }: ViewProps) {
  const box = useRef<HTMLDivElement>(null)
  const api = useRef<{ turn(axis: 'x' | 'y', dir: number): void; paint(solid: Set<number>, marks: Map<number, Mark>): void } | null>(null)
  const tapRef = useRef(onTap)
  tapRef.current = onTap

  useEffect(() => {
    const host = box.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      onFail()
      return
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0, n * 3.1)
    scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(3, 5, 6)
    scene.add(sun)

    // A fixed three-quarter tilt, so three faces show; the inner group snaps between the six faces.
    const tilt = new THREE.Group()
    tilt.rotation.set(0.5, -0.65, 0)
    const spin = new THREE.Group()
    tilt.add(spin)
    scene.add(tilt)
    const target = new THREE.Quaternion()

    const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94)
    const small = new THREE.BoxGeometry(0.7, 0.7, 0.7)
    const edges = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.55 })
    const mats = colors.map((c) => new THREE.MeshLambertMaterial({ color: c }))
    const markMats = Object.fromEntries(Object.entries(MARK_COLOR).map(([k, c]) => [k, new THREE.MeshLambertMaterial({ color: c, transparent: k === 'ghost', opacity: k === 'ghost' ? 0.55 : 1 })])) as Record<Mark, THREE.MeshLambertMaterial>
    const c0 = (n - 1) / 2
    const meshes = new Map<number, THREE.Mesh>()
    for (let cell = 0; cell < n ** 3; cell++) {
      const { x, y, z } = coords(cell, n)
      const m = new THREE.Mesh(geo, mats[(x + y + z) % mats.length])
      m.position.set(x - c0, c0 - y, c0 - z)
      m.userData.cell = cell
      m.add(new THREE.LineSegments(edges, edgeMat))
      spin.add(m)
      meshes.set(cell, m)
    }

    const paint = (solidNow: Set<number>, marksNow: Map<number, Mark>) => {
      for (const [cell, m] of meshes) {
        const mark = marksNow.get(cell)
        m.visible = solidNow.has(cell) || !!mark
        const { x, y, z } = coords(cell, n)
        m.material = mark ? markMats[mark] : mats[(x + y + z) % mats.length]
        m.geometry = mark && mark !== 'ghost' ? small : geo
      }
    }

    let w = 0
    const size = () => {
      w = host.clientWidth
      renderer.setSize(w, w)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(host)

    let raf = 0
    const loop = () => {
      if (reducedMotion) spin.quaternion.copy(target)
      else spin.quaternion.slerp(target, 0.2)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const turn = (axis: 'x' | 'y', dir: number) => {
      const q = new THREE.Quaternion().setFromAxisAngle(axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), (dir * Math.PI) / 2)
      target.premultiply(q)
    }

    // Drag to turn (a swipe snaps a quarter turn); a tap without a drag picks a block.
    let down: { x: number; y: number } | null = null
    let turned = false
    const ray = new THREE.Raycaster()
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      turned = false
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!down || turned) return
      const dx = e.clientX - down.x, dy = e.clientY - down.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 36) {
        turned = true
        if (Math.abs(dx) > Math.abs(dy)) turn('y', Math.sign(dx))
        else turn('x', Math.sign(dy))
      }
    }
    const onUp = (e: PointerEvent) => {
      if (down && !turned && tapRef.current) {
        const r = renderer.domElement.getBoundingClientRect()
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
        const hit = ray.intersectObjects([...meshes.values()].filter((m) => m.visible), false)[0]
        if (hit) tapRef.current(hit.object.userData.cell as number)
      }
      down = null
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)

    api.current = { turn, paint }
    paint(solid, marks)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      geo.dispose()
      small.dispose()
      edges.dispose()
      edgeMat.dispose()
      mats.forEach((m) => m.dispose())
      Object.values(markMats).forEach((m) => m.dispose())
      renderer.dispose()
      el.remove()
      api.current = null
    }
  }, [n, colors.join(), edge, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.current?.paint(solid, marks)
  }, [solid, marks])

  return (
    <div className="board grid justify-items-center gap-2">
      <div ref={box} className="w-full max-w-[360px] cursor-grab" aria-hidden />
      <div className="flex gap-1.5" role="group" aria-label="Turn the cube">
        <button className="btn btn-ghost px-3" onClick={() => api.current?.turn('y', -1)} aria-label="Turn left">
          ←
        </button>
        <button className="btn btn-ghost px-3" onClick={() => api.current?.turn('x', -1)} aria-label="Turn up">
          ↑
        </button>
        <button className="btn btn-ghost px-3" onClick={() => api.current?.turn('x', 1)} aria-label="Turn down">
          ↓
        </button>
        <button className="btn btn-ghost px-3" onClick={() => api.current?.turn('y', 1)} aria-label="Turn right">
          →
        </button>
      </div>
    </div>
  )
}

/** One layer at a time, top to bottom. Interior cells (never visible) are blank. */
function Layers({ n, solid, marks, onTap }: { n: number; solid: Set<number>; marks: Map<number, Mark>; onTap?(cell: number): void }) {
  const [layer, setLayer] = useState(0)
  const sym: Record<Mark, string> = { mark: '✗', right: '✓', wrong: '✗', ghost: '○' }
  return (
    <div className="board grid justify-items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1" role="tablist" aria-label="Layers, top to bottom">
        {Array.from({ length: n }, (_, y) => (
          <button key={y} role="tab" aria-selected={layer === y} className={`btn ${layer === y ? 'btn-primary' : 'btn-ghost'} px-3`} onClick={() => setLayer(y)}>
            {y === 0 ? 'Top' : y === n - 1 ? 'Bottom' : `Layer ${y + 1}`}
          </button>
        ))}
      </div>
      <span className="label">Back</span>
      <div className="grid w-full max-w-[320px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 4 }}>
        {Array.from({ length: n * n }, (_, i) => {
          const x = i % n, z = n - 1 - Math.floor(i / n) // back row first, front row last
          const cell = cellOf(x, layer, z, n)
          if (!onSurface(cell, n)) return <span key={i} className="aspect-square rounded-md" style={{ background: 'repeating-linear-gradient(45deg, var(--panel-2) 0 4px, transparent 4px 8px)' }} aria-hidden />
          const mark = marks.get(cell)
          const present = solid.has(cell)
          return (
            <button
              key={i}
              className="cell"
              disabled={!onTap}
              onClick={() => onTap?.(cell)}
              aria-label={`Layer ${layer + 1}, column ${x + 1}, row ${n - z} from the front${mark ? `, ${mark === 'ghost' ? 'missed' : 'marked'}` : present ? '' : ', missing'}`}
              style={{
                background: mark ? `color-mix(in srgb, ${MARK_COLOR[mark]} 35%, var(--panel))` : present ? 'var(--panel-2)' : 'transparent',
                boxShadow: mark ? `inset 0 0 0 3px ${MARK_COLOR[mark]}` : present ? undefined : 'inset 0 0 0 2px var(--line)',
              }}
            >
              <span className="text-lg font-extrabold">{mark ? sym[mark] : ''}</span>
            </button>
          )
        })}
      </div>
      <span className="label">Front</span>
    </div>
  )
}

export default function CubePlay({ trial, phase, skin, onDraft, onSubmit, review, reducedMotion }: PlayProps<Study, Test, Key, Answer, Params>) {
  const { n, count } = trial.test
  const colors = (skin.tokens.colors as string[]) ?? ['#e8b923']
  const edge = String(skin.tokens.edge ?? '#3a2c10')
  const [view, setView] = useState<'3d' | 'layers'>('3d')
  const [noGl, setNoGl] = useState(false)
  const [marked, setMarked] = useState<number[]>([])
  useDraft(marked, onDraft, phase)
  const all = useMemo(() => new Set(Array.from({ length: n ** 3 }, (_, c) => c)), [n])

  let solid = all
  let marks = new Map<number, Mark>()
  if (phase === 'study') {
    const gone = new Set(trial.study.missing)
    solid = new Set([...all].filter((c) => !gone.has(c)))
  } else if (phase === 'answer') {
    marks = new Map(marked.map((c) => [c, 'mark']))
  } else if (review) {
    const mine = new Set(review.answer ?? [])
    for (const c of review.key) marks.set(c, mine.has(c) ? 'right' : 'ghost')
    for (const c of mine) if (!marks.has(c)) marks.set(c, 'wrong')
  }
  const memoKey = `${phase}:${marked.join()}:${review ? 'r' : ''}`
  const stable = useStable(memoKey, { solid, marks })

  const toggle = (c: number) => {
    if (!onSurface(c, n)) return
    setMarked((m) => (m.includes(c) ? m.filter((x) => x !== c) : m.length >= n ** 3 ? m : [...m, c]))
  }
  const show3d = view === '3d' && !noGl
  return (
    <>
      {show3d ? (
        <CubeView n={n} solid={stable.solid} marks={stable.marks} colors={colors} edge={edge} onTap={phase === 'answer' ? toggle : undefined} reducedMotion={reducedMotion} onFail={() => setNoGl(true)} />
      ) : (
        <Layers n={n} solid={stable.solid} marks={stable.marks} onTap={phase === 'answer' ? toggle : undefined} />
      )}
      {!noGl && phase !== 'study' && (
        <div className="actions mt-1">
          <button className="link" onClick={() => setView(show3d ? 'layers' : '3d')}>
            {show3d ? 'Switch to layer view' : 'Switch to 3D view'}
          </button>
        </div>
      )}
      <p className="counter mt-1" aria-live="polite">
        {phase === 'study'
          ? `${count} block${count > 1 ? 's are' : ' is'} missing. Turn the cube to find ${count > 1 ? 'them' : 'it'}.`
          : phase === 'answer'
            ? `Tap the blocks that were missing · ${marked.length} marked of ${count}`
            : 'Green: found. Yellow: missed. Red: not missing.'}
      </p>
      {phase === 'answer' && <Done onClick={() => onSubmit(marked)} disabled={!marked.length} />}
    </>
  )
}

/** Keep object identity while `key` is unchanged, so the 3D view only repaints when something changed. */
function useStable<T>(key: string, value: T): T {
  const ref = useRef<{ key: string; value: T } | null>(null)
  if (!ref.current || ref.current.key !== key) ref.current = { key, value }
  return ref.current.value
}
