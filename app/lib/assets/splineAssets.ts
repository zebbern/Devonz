/**
 * Spline Asset Library
 *
 * A curated collection of verified, working Spline 3D scenes
 * that Bolt can offer to users when they request 3D content.
 *
 * All URLs MUST be in the format:
 * https://prod.spline.design/{scene-id}/scene.splinecode
 *
 * Before adding an asset:
 * 1. Verify the URL returns 200 OK
 * 2. Test the scene loads correctly
 * 3. Capture a thumbnail if possible
 * 4. Add proper metadata
 */

import type { SplineAsset, SplineAssetCollection, SplineAssetFilter, SplineCategory } from './splineAssetTypes';

/**
 * The curated asset library
 * Assets are verified to work with @splinetool/react-spline
 */
export const splineAssets: SplineAsset[] = [
    /* ABSTRACT / EXAMPLE SCENES */
    {
        id: 'interactive-cube',
        name: 'Interactive Cube',
        description:
            'A colorful interactive 3D cube that responds to mouse movement. Great for testing and simple decorative elements.',
        category: 'abstract',
        sceneUrl: 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
        tags: ['cube', 'interactive', 'colorful', 'simple', 'example', 'beginner'],
        verified: true,
        verifiedDate: '2026-01-23',
        license: 'CC0',
        interactive: true,
        keywords: ['cube', 'box', '3d shape', 'interactive', 'hover effect', 'simple 3d', 'demo'],
    },
    {
        id: 'abstract-shapes',
        name: 'Abstract Shapes',
        description:
            'A collection of floating abstract 3D shapes with smooth animations. Perfect for hero sections and backgrounds.',
        category: 'abstract',
        sceneUrl: 'https://prod.spline.design/KFonZGtsoUXP-qx7/scene.splinecode',
        tags: ['abstract', 'shapes', 'floating', 'hero', 'background', 'animated'],
        verified: true,
        verifiedDate: '2026-01-23',
        license: 'CC0',
        interactive: false,
        keywords: ['abstract', 'geometric', 'floating', 'hero section', 'background', 'modern', 'minimal'],
    },
    {
        id: '3d-dashboard-hero',
        name: '3D Dashboard Hero',
        description:
            'A sleek 3D scene designed for dashboard hero sections. Modern and professional look with subtle animations.',
        category: 'ui',
        sceneUrl: 'https://prod.spline.design/i8eNphGELT2tDQVT/scene.splinecode',
        tags: ['dashboard', 'hero', 'ui', 'modern', 'professional', 'business'],
        verified: true,
        verifiedDate: '2026-01-23',
        license: 'CC0',
        interactive: true,
        keywords: ['dashboard', 'hero section', 'ui design', 'saas', 'startup', 'landing page', 'business'],
    },

    /*
     * Add more assets here as they are verified.
     * Template:
     * {
     *   id: 'unique-id',
     *   name: 'Asset Name',
     *   description: 'Brief description',
     *   category: 'category',
     *   sceneUrl: 'https://prod.spline.design/xxx/scene.splinecode',
     *   tags: ['tag1', 'tag2'],
     *   verified: true,
     *   verifiedDate: 'YYYY-MM-DD',
     *   license: 'CC0',
     *   interactive: false,
     *   keywords: ['keyword1', 'keyword2'],
     * },
     */
];

/**
 * Get the full asset collection with metadata
 */
export function getAssetCollection(): SplineAssetCollection {
    return {
        version: '1.0.0',
        lastUpdated: '2026-01-23',
        totalAssets: splineAssets.length,
        assets: splineAssets,
    };
}

/**
 * Get all verified assets
 */
export function getVerifiedAssets(): SplineAsset[] {
    return splineAssets.filter((asset) => asset.verified);
}

/**
 * Get assets by category
 */
export function getAssetsByCategory(category: SplineCategory): SplineAsset[] {
    return splineAssets.filter((asset) => asset.category === category && asset.verified);
}

/**
 * Find a single asset by ID
 */
export function getAssetById(id: string): SplineAsset | undefined {
    return splineAssets.find((asset) => asset.id === id);
}

/**
 * Find assets by name (partial match, case-insensitive)
 */
export function getAssetsByName(name: string): SplineAsset[] {
    const lowercaseName = name.toLowerCase();
    return splineAssets.filter((asset) => asset.verified && asset.name.toLowerCase().includes(lowercaseName));
}

/**
 * Search assets across all fields
 */
export function searchAssets(query: string): SplineAsset[] {
    const lowercaseQuery = query.toLowerCase();

    return splineAssets.filter((asset) => {
        if (!asset.verified) {
            return false;
        }

        return (
            asset.name.toLowerCase().includes(lowercaseQuery) ||
            asset.description.toLowerCase().includes(lowercaseQuery) ||
            asset.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
            asset.keywords?.some((kw) => kw.toLowerCase().includes(lowercaseQuery)) ||
            asset.category.toLowerCase().includes(lowercaseQuery)
        );
    });
}

/**
 * Filter assets with multiple criteria
 */
export function filterAssets(filter: SplineAssetFilter): SplineAsset[] {
    let results = splineAssets;

    // Filter by verified only (default true)
    if (filter.verifiedOnly !== false) {
        results = results.filter((asset) => asset.verified);
    }

    // Filter by category
    if (filter.category) {
        results = results.filter((asset) => asset.category === filter.category);
    }

    // Filter by interactive
    if (filter.interactive !== undefined) {
        results = results.filter((asset) => asset.interactive === filter.interactive);
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
        results = results.filter((asset) => filter.tags!.some((tag) => asset.tags.includes(tag.toLowerCase())));
    }

    // Search query
    if (filter.search) {
        const query = filter.search.toLowerCase();
        results = results.filter(
            (asset) =>
                asset.name.toLowerCase().includes(query) ||
                asset.description.toLowerCase().includes(query) ||
                asset.tags.some((tag) => tag.includes(query)) ||
                asset.keywords?.some((kw) => kw.includes(query)),
        );
    }

    return results;
}

/**
 * Get a random asset from a category (useful for suggestions)
 */
export function getRandomAsset(category?: SplineCategory): SplineAsset | undefined {
    const assets = category ? getAssetsByCategory(category) : getVerifiedAssets();

    if (assets.length === 0) {
        return undefined;
    }

    return assets[Math.floor(Math.random() * assets.length)];
}

/**
 * Get all available categories that have assets
 */
export function getAvailableCategories(): SplineCategory[] {
    const categories = new Set<SplineCategory>();
    splineAssets.filter((a) => a.verified).forEach((asset) => categories.add(asset.category));

    return Array.from(categories);
}

/**
 * Format asset for display in chat/prompts
 */
export function formatAssetForDisplay(asset: SplineAsset): string {
    const interactive = asset.interactive ? ' (Interactive)' : '';
    return `**${asset.name}**${interactive} - ${asset.description}`;
}

/**
 * Get asset library summary for LLM prompts
 */
export function getAssetLibrarySummary(): string {
    const verified = getVerifiedAssets();
    const categories = getAvailableCategories();

    if (verified.length === 0) {
        return 'No verified Spline assets available yet.';
    }

    let summary = `Available Spline 3D Assets (${verified.length} verified):\n`;

    categories.forEach((category) => {
        const categoryAssets = getAssetsByCategory(category);

        if (categoryAssets.length > 0) {
            summary += `\n${category.toUpperCase()}:\n`;
            categoryAssets.forEach((asset) => {
                summary += `- ${asset.name}: ${asset.description}\n`;
            });
        }
    });

    return summary;
}
