import { ASSETS } from '../config/assets'
import AssetButton from '../components/AssetButton'

export default function AssetPanel({ selectedAsset, onSelect }) {
  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-4">
        Assets
      </h2>
      <div className="flex flex-col gap-1">
        {ASSETS.map(asset => (
          <AssetButton
            key={asset.id}
            label={asset.label}
            isSelected={selectedAsset === asset.id}
            onClick={() => onSelect(asset.id)}
          />
        ))}
      </div>
    </>
  )
}
