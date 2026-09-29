import { Bounds, Center, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

function ObjAsset({ url }: { url: string }) {
  const source = useLoader(OBJLoader, url)
  const model = useMemo(() => source.clone(true), [source])

  useEffect(() => {
    model.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.material = new MeshStandardMaterial({ color: '#63d8c1', roughness: 0.78, metalness: 0.08, side: 2 })
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [model])

  return <primitive object={model} />
}

export function RealModelCanvas({ modelUrl }: { modelUrl: string }) {
  return <div className="real-model-canvas">
    <Canvas camera={{ position: [3.4, 2.2, 3.4], fov: 44 }} dpr={[1, 1.75]}>
      <color attach="background" args={['#0c171a']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 7, 4]} intensity={2.4} castShadow />
      <pointLight position={[-4, 2, -3]} intensity={1.1} color="#4aaad8" />
      <Grid args={[20, 20]} cellSize={0.5} cellThickness={0.55} cellColor="#274740" sectionSize={2.5} sectionThickness={0.85} sectionColor="#3a786d" fadeDistance={22} fadeStrength={1.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.35}>
          <Center>
            <ObjAsset url={modelUrl} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  </div>
}
