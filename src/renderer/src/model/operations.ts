import type { Project } from './schema'

/**
 * Change le format de la composition en gardant la mise en page : le contenu est mis à
 * l'échelle pour tenir dans le nouveau cadre et reste centré.
 */
export function changeFormat(draft: Project, width: number, height: number): void {
  const s = Math.min(width / draft.width, height / draft.height)
  const ocx = draft.width / 2
  const ocy = draft.height / 2
  for (const layer of draft.layers) {
    const t = layer.transform
    t.x = (t.x - ocx) * s + width / 2
    t.y = (t.y - ocy) * s + height / 2
    t.width *= s
    t.height *= s
    switch (layer.type) {
      case 'text':
        layer.props.fontSize *= s
        layer.props.letterSpacing *= s
        if (layer.props.highlight) layer.props.highlight.padding *= s
        if (layer.props.outline) layer.props.outline.width *= s
        if (layer.props.shadow) {
          layer.props.shadow.blur *= s
          layer.props.shadow.offsetY *= s
        }
        break
      case 'shape':
      case 'media':
        layer.props.strokeWidth *= s
        layer.props.radius *= s
        break
      case 'background':
        // Un fond couvre toujours tout le cadre.
        t.x = width / 2
        t.y = height / 2
        t.width = width
        t.height = height
        layer.props.patternSize *= s
        break
    }
  }
  draft.width = width
  draft.height = height
}

/** Change la durée ; les calques qui allaient jusqu'à la fin continuent d'y aller. */
export function changeDuration(draft: Project, duration: number): void {
  const old = draft.duration
  for (const layer of draft.layers) {
    if (layer.end >= old) layer.end = duration
    layer.end = Math.min(layer.end, duration)
    layer.start = Math.min(layer.start, Math.max(0, layer.end - 0.1))
  }
  draft.duration = duration
}
