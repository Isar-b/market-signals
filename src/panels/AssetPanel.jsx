import { useMemo } from 'react'
import AssetButton from '../components/AssetButton'
import AssetSearch from '../components/AssetSearch'
import AuthButton from '../components/AuthButton'

export default function AssetPanel({ assets, selectedAsset, onSelect, onAdd, onRemove, onMove, auth, isLoggedIn }) {
  const existingIds = useMemo(() => new Set([
    ...assets.map(a => a.yahooSymbol).filter(Boolean),
    ...assets.map(a => a.hlSymbol).filter(Boolean),
  ]), [assets])

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Assets
      </h2>
      <AssetSearch onAdd={onAdd} existingIds={existingIds} disabled={!isLoggedIn} />
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {assets.map((asset, i) => (
          <AssetButton
            key={asset.id}
            label={asset.label}
            source={asset.source}
            isSelected={selectedAsset === asset.id}
            onClick={() => onSelect(asset.id)}
            onRemove={() => onRemove(asset.id)}
            canRemove={assets.length > 1}
            onMoveUp={i > 0 ? () => onMove(asset.id, -1) : null}
            onMoveDown={i < assets.length - 1 ? () => onMove(asset.id, 1) : null}
            locked={!isLoggedIn}
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
              onLoginGoogle={auth.loginWithGoogle}
              onLogout={auth.logout}
            />
          </div>
          <div className="text-[10px] text-text-secondary leading-tight">
            Created by Isar
            <br />
            Powered by Yahoo Finance, Hyperliquid &amp; Polymarket
          </div>
        </div>
      )}
    </>
  )
}
