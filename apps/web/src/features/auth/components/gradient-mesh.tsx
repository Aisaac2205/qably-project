'use client'

import { useEffect, useRef } from 'react'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useReducedMotion } from '@/features/auth/hooks/use-reduced-motion'
import type { Rgb } from '@/features/auth/lib/css-color'
import { readMeshPalette } from '@/features/auth/lib/mesh-palette'

const vert = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
}
`

const frag = (distortion: number) => `
precision highp float;

uniform float uTime;
uniform float uSwirl;
uniform float uSpeed;
uniform float uScale;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uRotation;
uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uWaveSpeed;
uniform float uGrain;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uResolution;

varying vec2 vUv;

float wave(vec2 uv, float freq, float speed, float time) {
    return sin(uv.x * freq + time * speed) * cos(uv.y * freq + time * speed);
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec3 colorDodge(vec3 base, vec3 blend) {
    return min(base / (1.0 - blend + 0.0001), 1.0);
}

void main() {
    float mr = min(uResolution.x, uResolution.y);
    vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

    uv = uv * uScale + vec2(uOffsetX, uOffsetY);

    float cosR = cos(uRotation);
    float sinR = sin(uRotation);
    uv = vec2(
        uv.x * cosR - uv.y * sinR,
        uv.x * sinR + uv.y * cosR
    );

    uv.x += wave(uv, uWaveFreq, uWaveSpeed, uTime) * uWaveAmp;
    uv.y += wave(uv + 10.0, uWaveFreq * 1.5, uWaveSpeed * 0.8, uTime) * uWaveAmp * 0.5;

    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    angle += uSwirl * radius;
    uv = vec2(cos(angle), sin(angle)) * radius;

    float d = -uTime * 0.5 * uSpeed;
    float a = 0.0;
    for (float i = 0.0; i < ${distortion.toFixed(1)}; ++i) {
        a += cos(i - d - a * uv.x);
        d += sin(uv.y * i + a);
    }
    d += uTime * 0.5 * uSpeed;

    float mix1 = (sin(d) + 1.0) * 0.5;
    float mix2 = (cos(a) + 1.0) * 0.5;
    vec3 col = mix(uColorA, uColorB, mix1);
    col = mix(col, uColorC, mix2);

    float grain = (random(gl_FragCoord.xy + uTime) - 0.5) * uGrain;
    vec3 grainCol = vec3(0.5 + grain);
    col = colorDodge(col, grainCol);

    gl_FragColor = vec4(col, 1.0);
}
`

interface GradientMeshProps {
  distortion?: number
  swirl?: number
  speed?: number
  scale?: number
  offsetX?: number
  offsetY?: number
  rotation?: number
  waveAmp?: number
  waveFreq?: number
  waveSpeed?: number
  grain?: number
}

export function GradientMesh({
  distortion = 8,
  swirl = 0.2,
  speed = 1,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  rotation = 90,
  waveAmp = 0.2,
  waveFreq = 20,
  waveSpeed = 0.2,
  grain = 0.06,
}: GradientMeshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const palette = readMeshPalette()

    let renderer: Renderer
    try {
      renderer = new Renderer()
    } catch {
      return
    }

    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 1)

    const resize = () => renderer.setSize(container.offsetWidth, container.offsetHeight)
    window.addEventListener('resize', resize, false)
    resize()

    const uniforms: Record<string, { value: unknown }> = {
      uTime: { value: 0 },
      uSwirl: { value: swirl },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uOffsetX: { value: offsetX },
      uOffsetY: { value: offsetY },
      uRotation: { value: rotation },
      uWaveAmp: { value: waveAmp },
      uWaveFreq: { value: waveFreq },
      uWaveSpeed: { value: waveSpeed },
      uGrain: { value: grain },
      uResolution: {
        value: new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ),
      },
    }

    const labels = ['A', 'B', 'C']
    palette.slice(0, 3).forEach((rgb: Rgb, index) => {
      uniforms[`uColor${labels[index]}`] = { value: new Color(...rgb) }
    })

    const program = new Program(gl, {
      vertex: vert,
      fragment: frag(distortion),
      uniforms,
    })
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

    container.appendChild(gl.canvas)

    let frameId = 0
    if (reducedMotion) {
      program.uniforms.uTime.value = 0
      renderer.render({ scene: mesh })
    } else {
      const update = (t: number) => {
        frameId = requestAnimationFrame(update)
        program.uniforms.uTime.value = t * 0.001
        renderer.render({ scene: mesh })
      }
      frameId = requestAnimationFrame(update)
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      if (gl.canvas.parentNode === container) container.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [
    reducedMotion,
    distortion,
    swirl,
    speed,
    scale,
    offsetX,
    offsetY,
    rotation,
    waveAmp,
    waveFreq,
    waveSpeed,
    grain,
  ])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-hidden bg-canvas"
    />
  )
}
