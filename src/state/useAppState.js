import { useState } from 'react'

export function useAppState() {
  const [selectedAsset, setSelectedAsset] = useState('SP500')
  const [selectedHorizon, setSelectedHorizon] = useState('YTD')

  return { selectedAsset, setSelectedAsset, selectedHorizon, setSelectedHorizon }
}
