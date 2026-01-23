import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { SearchInput } from './SearchInput';
import { SplineAssetCard } from './SplineAssetCard';
import { getVerifiedAssets, getAssetsByCategory, searchAssets } from '~/lib/assets';
import type { SplineAsset, SplineCategory } from '~/lib/assets';

interface SplineAssetPickerProps {
    onSelect: (asset: SplineAsset) => void;
    onCancel?: () => void;
    selectedAssetId?: string;
    compact?: boolean;
    className?: string;
}

/**
 * SplineAssetPicker - A visual picker for selecting Spline 3D assets
 *
 * Features:
 * - Grid view of available assets
 * - Category filtering
 * - Search functionality
 * - Preview on hover
 */
export const SplineAssetPicker = memo(
    ({ onSelect, onCancel, selectedAssetId, compact = false, className }: SplineAssetPickerProps) => {
        const [searchQuery, setSearchQuery] = useState('');
        const [selectedCategory, setSelectedCategory] = useState<SplineCategory | 'all'>('all');
        const [hoveredAsset, setHoveredAsset] = useState<SplineAsset | null>(null);

        /* Get filtered assets based on search and category */
        const filteredAssets = useMemo(() => {
            let assets = getVerifiedAssets();

            if (selectedCategory !== 'all') {
                assets = getAssetsByCategory(selectedCategory);
            }

            if (searchQuery.trim()) {
                assets = searchAssets(searchQuery);

                if (selectedCategory !== 'all') {
                    assets = assets.filter((a) => a.category === selectedCategory);
                }
            }

            return assets;
        }, [searchQuery, selectedCategory]);

        /* Get available categories that have assets */
        const availableCategories = useMemo(() => {
            const categories = new Set<SplineCategory>();
            getVerifiedAssets().forEach((asset) => categories.add(asset.category));

            return Array.from(categories);
        }, []);

        const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchQuery(e.target.value);
        }, []);

        const handleClearSearch = useCallback(() => {
            setSearchQuery('');
        }, []);

        const handleCategoryChange = useCallback((category: SplineCategory | 'all') => {
            setSelectedCategory(category);
        }, []);

        const handleAssetSelect = useCallback(
            (asset: SplineAsset) => {
                onSelect(asset);
            },
            [onSelect],
        );

        return (
            <div className={classNames('flex flex-col', compact ? 'gap-3' : 'gap-4', className)}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={classNames('i-ph:cube-duotone text-purple-500', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                        <h3 className={classNames('font-semibold text-bolt-elements-textPrimary', compact ? 'text-sm' : 'text-lg')}>
                            Spline 3D Assets
                        </h3>
                        <span className="text-xs text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 px-2 py-0.5 rounded-full">
                            {filteredAssets.length} available
                        </span>
                    </div>

                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors p-1"
                            aria-label="Close picker"
                        >
                            <span className="i-ph:x w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Search and Filters */}
                <div className={classNames('flex gap-3', compact ? 'flex-col' : 'flex-row')}>
                    <SearchInput
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onClear={handleClearSearch}
                        placeholder="Search assets..."
                        className="flex-1"
                    />

                    {/* Category filters */}
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => handleCategoryChange('all')}
                            className={classNames(
                                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                                selectedCategory === 'all'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
                            )}
                        >
                            All
                        </button>
                        {availableCategories.map((category) => (
                            <button
                                key={category}
                                onClick={() => handleCategoryChange(category)}
                                className={classNames(
                                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
                                    selectedCategory === category
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
                                )}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Asset Grid */}
                <div className={classNames('overflow-y-auto', compact ? 'max-h-48' : 'max-h-80')}>
                    {filteredAssets.length > 0 ? (
                        <div
                            className={classNames(
                                'grid gap-3',
                                compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
                            )}
                        >
                            <AnimatePresence mode="popLayout">
                                {filteredAssets.map((asset) => (
                                    <motion.div
                                        key={asset.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2 }}
                                        onMouseEnter={() => setHoveredAsset(asset)}
                                        onMouseLeave={() => setHoveredAsset(null)}
                                    >
                                        <SplineAssetCard
                                            asset={asset}
                                            selected={asset.id === selectedAssetId}
                                            onSelect={handleAssetSelect}
                                            compact={compact}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                            <span className="i-ph:cube-transparent w-12 h-12 mb-2 opacity-50" />
                            <p className="text-sm">No assets found</p>
                            {searchQuery && (
                                <button onClick={handleClearSearch} className="text-purple-500 text-sm mt-2 hover:underline">
                                    Clear search
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Hover Preview (for non-compact mode) */}
                {!compact && hoveredAsset && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded bg-bolt-elements-background-depth-1 flex items-center justify-center">
                                <span className="i-ph:cube-duotone w-6 h-6 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-bolt-elements-textPrimary text-sm">{hoveredAsset.name}</h4>
                                <p className="text-xs text-bolt-elements-textSecondary mt-0.5">{hoveredAsset.description}</p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-bolt-elements-textTertiary">
                                    {hoveredAsset.interactive && (
                                        <span className="flex items-center gap-1">
                                            <span className="i-ph:cursor-click w-3 h-3" /> Interactive
                                        </span>
                                    )}
                                    <span className="capitalize">{hoveredAsset.category}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Info footer */}
                <div className="text-xs text-bolt-elements-textTertiary flex items-center gap-1">
                    <span className="i-ph:info w-3 h-3" />
                    Click an asset to add it to your project. All assets are verified to work.
                </div>
            </div>
        );
    },
);

SplineAssetPicker.displayName = 'SplineAssetPicker';
