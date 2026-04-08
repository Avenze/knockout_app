import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// Produce a lean, self-contained server for Docker runtime
	output: 'standalone',
	// Enable compression for better performance
	compress: true,
	// Enable image optimization
	images: {
		domains: [], // Add your image domains here
		formats: ['image/webp', 'image/avif'],
	},
	// Configure headers for SEO and performance
	async headers() {
		return [
			{
				source: '/assets/:path*',
				headers: [
					{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
				],
			},
			{
				source: '/(.*)',
				headers: [
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'X-Frame-Options',
						value: 'SAMEORIGIN',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
					{
						key: 'X-DNS-Prefetch-Control',
						value: 'on',
					},
				],
			},
			{
				source: '/favicon.png',
				headers: [
					{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
				],
			},
			{
				source: '/manifest.json',
				headers: [
					{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
				],
			},
		];
	},
	// Configure redirects for SEO
	async redirects() {
		return [
			{
				source: '/home',
				destination: '/',
				permanent: true,
			},
		];
	},
};

export default nextConfig;