import { useMemo } from 'react'
import AssetButton from '../components/AssetButton'
import AssetSearch from '../components/AssetSearch'
import AuthButton from '../components/AuthButton'

export default function AssetPanel({ assets, selectedAsset, onSelect, onAdd, onRemove, auth }) {
  const existingIds = useMemo(() => new Set(assets.map(a => a.yahooSymbol)), [assets])

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Assets
      </h2>
      <AssetSearch onAdd={onAdd} existingIds={existingIds} />
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {assets.map(asset => (
          <AssetButton
            key={asset.id}
            label={asset.label}
            isSelected={selectedAsset === asset.id}
            onClick={() => onSelect(asset.id)}
            onRemove={() => onRemove(asset.id)}
            canRemove={assets.length > 1}
          />
        ))}
      </div>
      {auth && (
        <div className="mt-auto pt-3 border-t border-border">
          <div className="mb-2">
            <AuthButton
              user={auth.user}
              loading={auth.loading}
              onLoginGithub={auth.loginWithGithub}
              onLogout={auth.logout}
            />
          </div>
          <div className="text-[10px] text-text-secondary leading-tight">
            Created by Isar
            <br />
            Powered by Yahoo Finance &amp; Polymarket
          </div>
        </div>
      )}
    </>
  )
}
