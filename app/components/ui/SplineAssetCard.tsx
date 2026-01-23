import React, { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { SplineAsset } from '~/lib/assets';

interface SplineAssetCardProps {
    asset: SplineAsset;
    selected?: boolean;
    onSelect?: (asset: SplineAsset) => void;
    compact?: boolean;
}

/**
 * SplineAssetCard - Displays a single Spline asset with preview and metadata
 */
export const SplineAssetCard = memo(({ asset, selected = false, onSelect, compact = false }: SplineAssetCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [previewLoaded, setPreviewLoaded] = useState(false);
    const [previewError, setPreviewError] = useState(false);

    const handleClick = useCallback(() => {
        if (onSelect) {
            onSelect(asset);
        }
    }, [asset, onSelect]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        },
        [handleClick],
    );

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={classNames(
                'group relative rounded-lg border cursor-pointer transition-all duration-200',
                'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                selected
                    ? 'border-purple-500 ring-2 ring-purple-500/30'
                    : 'border-bolt-elements-borderColor hover:border-purple-400',
                compact ? 'p-2' : 'p-3',
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Select ${asset.name}`}
        >
            {/* Preview Area */}
            <div
                className={classNames(
                    'relative rounded-md overflow-hidden bg-bolt-elements-background-depth-1',
                    'flex items-center justify-center',
                    compact ? 'h-16 mb-2' : 'h-24 mb-3',
                )}
            >
                {/* Thumbnail or Placeholder */}
                {asset.thumbnailUrl && !previewError ? (
                    <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className={classNames(
                            'w-full h-full object-cover transition-opacity duration-300',
                            previewLoaded ? 'opacity-100' : 'opacity-0',
                        )}
                        onLoad={() => setPreviewLoaded(true)}
                        onError={() => setPreviewError(true)}
                    />
                ) : null}

                {/* Fallback placeholder with icon */}
                {(!asset.thumbnailUrl || previewError || !previewLoaded) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-bolt-elements-textTertiary">
                        <span className={classNames('i-ph:cube-duotone', compact ? 'w-6 h-6' : 'w-8 h-8')} />
                        {!compact && <span className="text-xs mt-1 opacity-60">3D Preview</span>}
                    </div>
                )}

                {/* Interactive indicator */}
                {asset.interactive && (
                    <div className="absolute top-1 right-1 bg-purple-500/80 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <span className="i-ph:cursor-click w-3 h-3" />
                        {!compact && <span>Interactive</span>}
                    </div>
                )}

                {/* Hover overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-2"
                >
                    <span className="text-white text-xs font-medium">Click to select</span>
                </motion.div>
            </div>

            {/* Asset Info */}
            <div className="space-y-1">
                <h4
                    className={classNames('font-medium text-bolt-elements-textPrimary truncate', compact ? 'text-xs' : 'text-sm')}
                >
                    {asset.name}
                </h4>

                {!compact && <p className="text-xs text-bolt-elements-textSecondary line-clamp-2">{asset.description}</p>}

                {/* Tags */}
                {!compact && asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {asset.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="text-xs bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary px-1.5 py-0.5 rounded"
                            >
                                {tag}
                            </span>
                        ))}
                        {asset.tags.length > 3 && (
                            <span className="text-xs text-bolt-elements-textTertiary">+{asset.tags.length - 3}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Selection checkmark */}
            {selected && (
                <div className="absolute top-2 left-2 bg-purple-500 text-white rounded-full p-0.5">
                    <span className="i-ph:check-bold w-3 h-3" />
                </div>
            )}
        </motion.div>
    );
});

SplineAssetCard.displayName = 'SplineAssetCard';
