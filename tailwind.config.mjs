/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

export default {
    darkMode: ["class"],
    content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "col-span-1",
    "col-span-2",
    "col-span-3",
    "col-span-4",
    "animate-delay-100",
    "animate-delay-300",
    "animate-delay-500",
    "animate-delay-700",
  ],
  theme: {
  	extend: {
  		boxShadow: {
  			glow: '0 0 0.5vw 0.1vw rgba(255, 255, 255, 0.3), 0 0 1vw 0.5vw rgba(255, 255, 255, 0.1)'
  		},
  		colors: {
  			ieee: {
  				yellow: '#F3C135',
  				black: '#0A0E1A',
  				'blue-100': '#88BFEC',
  				'blue-300': '#233363'
  			},
  			project_card_bg: '#0d1324',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(circle at 0% 0%, var(--tw-gradient-stops))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	},
  	daisyui: {
  		themes: [
  			{
  				light: {
  					primary: '#06659d',
  					secondary: '#4b92db',
  					accent: '#F3C135',
  					neutral: '#2a323c',
  					'base-100': '#ffffff',
  					'base-200': '#f8f9fa',
  					'base-300': '#e9ecef',
  					info: '#3abff8',
  					success: '#36d399',
  					warning: '#fbbd23',
  					error: '#f87272'
  				},
  				dark: {
  					primary: '#88BFEC',
  					secondary: '#4b92db',
  					accent: '#F3C135',
  					neutral: '#191D24',
  					'base-100': '#0A0E1A',
  					'base-200': '#0d1324',
  					'base-300': '#1a2035',
  					info: '#3abff8',
  					success: '#36d399',
  					warning: '#fbbd23',
  					error: '#f87272'
  				}
  			}
  		]
  	}
  },
  plugins: [
    require("tailwindcss-motion"),
    require("tailwindcss-animated"),
    require("daisyui"),
    function ({ addVariant }) {
      addVariant("in-view", "&.in-view");
    },
    heroui(),
      require("tailwindcss-animate")
],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#06659d",
          secondary: "#4b92db",
          accent: "#F3C135",
          neutral: "#2a323c",
          "base-100": "#ffffff",
          "base-200": "#f8f9fa",
          "base-300": "#e9ecef",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
        dark: {
          primary: "#88BFEC",
          secondary: "#4b92db",
          accent: "#F3C135",
          neutral: "#191D24",
          "base-100": "#0A0E1A",
          "base-200": "#0d1324",
          "base-300": "#1a2035",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],
  },
};
