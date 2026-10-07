declare module 'cytoscape-dagre'
declare module 'cytoscape-cola'

declare module 'react-force-graph-3d' {
  import { ComponentType } from 'react'
  // Loose props — library has no bundled types
  const ForceGraph3D: ComponentType<Record<string, any>>
  export default ForceGraph3D
}
