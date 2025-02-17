import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/utils';


const buttonVariants = cva(
	'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent text-xs gap-2 px-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground/90 hover:bg-primary/90',
				primary: 'bg-primary text-primary-foreground/90 hover:bg-primary/90',
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20',
				outline:
					'border border-input bg-background hover:bg-accent hover:text-primary',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-primary',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-7',
				sm: 'h-7 rounded-md px-3 text-xs',
				lg: 'h-10 rounded-md px-8',
				icon: 'h-7 w-7 p-1',
			},
		},
		defaultVariants: {
			variant: 'ghost',
			size: 'default',
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
	VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, type, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				type={type || 'button'}
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
