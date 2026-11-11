import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
	title: string;
	description?: ReactNode;
	/** Specific action label, e.g. "Delete Link". */
	confirmLabel: string;
	cancelLabel?: string;
	destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const resolveRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback<Confirm>((next) => {
		resolveRef.current?.(false);
		setOptions(next);
		return new Promise<boolean>((resolve) => {
			resolveRef.current = resolve;
		});
	}, []);

	const settle = (value: boolean) => {
		resolveRef.current?.(value);
		resolveRef.current = null;
		setOptions(null);
	};

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<AlertDialog
				open={options !== null}
				onOpenChange={(open) => {
					if (!open) settle(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="text-balance">
							{options?.title}
						</AlertDialogTitle>
						{options?.description ? (
							<AlertDialogDescription className="text-pretty">
								{options.description}
							</AlertDialogDescription>
						) : null}
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => settle(false)}>
							{options?.cancelLabel ?? "Cancel"}
						</AlertDialogCancel>
						<AlertDialogAction
							variant={options?.destructive ? "destructive" : "default"}
							onClick={() => settle(true)}
						>
							{options?.confirmLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext.Provider>
	);
}

/**
 * Promise-based confirmation, e.g.
 * `if (!(await confirm({ title: "Delete link?", confirmLabel: "Delete Link", destructive: true }))) return;`
 */
export function useConfirm(): Confirm {
	const confirm = useContext(ConfirmContext);
	if (!confirm) {
		throw new Error("useConfirm must be used within ConfirmProvider");
	}
	return confirm;
}
