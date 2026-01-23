import React, { memo, useCallback, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { dialogBackdropVariants, dialogVariants, DialogTitle, DialogDescription } from './Dialog';
import { SplineAssetPicker } from './SplineAssetPicker';
import type { SplineAsset } from '~/lib/assets';

interface SplineAssetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAssetSelected: (asset: SplineAsset) => void;
}

/**
 * SplineAssetDialog - A modal dialog for selecting Spline 3D assets
 *
 * Use this when you want a full-screen picker experience.
 */
export const SplineAssetDialog = memo(({ open, onOpenChange, onAssetSelected }: SplineAssetDialogProps) => {
    const [selectedAsset, setSelectedAsset] = useState<SplineAsset | null>(null);

    const handleAssetSelect = useCallback((asset: SplineAsset) => {
        setSelectedAsset(asset);
    }, []);

    const handleConfirm = useCallback(() => {
        if (selectedAsset) {
            onAssetSelected(selectedAsset);
            onOpenChange(false);
            setSelectedAsset(null);
        }
    }, [selectedAsset, onAssetSelected, onOpenChange]);

    const handleCancel = useCallback(() => {
        onOpenChange(false);
        setSelectedAsset(null);
    }, [onOpenChange]);

    return (
        <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay asChild>
                    <motion.div
                        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={dialogBackdropVariants}
                    />
                </RadixDialog.Overlay>
                <RadixDialog.Content asChild>
                    <motion.div
                        className={classNames(
                            'fixed top-1/2 left-1/2 z-[10000]',
                            'w-[90vw] max-w-3xl max-h-[85vh]',
                            'bg-bolt-elements-background-depth-1 rounded-xl shadow-2xl',
                            'border border-bolt-elements-borderColor',
                            'flex flex-col overflow-hidden',
                        )}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={dialogVariants}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-bolt-elements-borderColor">
                            <div>
                                <DialogTitle className="flex items-center gap-2">
                                    <span className="i-ph:cube-duotone text-purple-500 w-5 h-5" />
                                    Choose a 3D Asset
                                </DialogTitle>
                                <DialogDescription>Select a pre-verified Spline scene to add to your project</DialogDescription>
                            </div>
                            <RadixDialog.Close asChild>
                                <button
                                    className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors p-2 rounded-lg hover:bg-bolt-elements-background-depth-2"
                                    aria-label="Close"
                                >
                                    <span className="i-ph:x w-5 h-5" />
                                </button>
                            </RadixDialog.Close>
                        </div>

                        {/* Picker Content */}
                        <div className="flex-1 overflow-hidden p-6">
                            <SplineAssetPicker onSelect={handleAssetSelect} selectedAssetId={selectedAsset?.id} className="h-full" />
                        </div>

                        {/* Footer with actions */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
                            <div className="text-sm text-bolt-elements-textSecondary">
                                {selectedAsset ? (
                                    <span className="flex items-center gap-2">
                                        <span className="i-ph:check-circle text-green-500 w-4 h-4" />
                                        Selected: <strong>{selectedAsset.name}</strong>
                                    </span>
                                ) : (
                                    <span className="text-bolt-elements-textTertiary">No asset selected</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={!selectedAsset}
                                    className={classNames(
                                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                        selectedAsset
                                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                                            : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary cursor-not-allowed',
                                    )}
                                >
                                    Add to Project
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </RadixDialog.Content>
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
});

SplineAssetDialog.displayName = 'SplineAssetDialog';
