/**
 * `/componentes/novo` — criação de componente (página de composição).
 * `?tipo=embalagem` abre o formulário já marcado como embalagem.
 */

import { useSearchParams } from 'react-router-dom'
import { ComponenteFormPage } from './ComponenteFormPage'

export function ComponenteNovoPage() {
  const [searchParams] = useSearchParams()
  const isPackaging = searchParams.get('tipo') === 'embalagem'
  return <ComponenteFormPage isPackagingInicial={isPackaging} />
}
