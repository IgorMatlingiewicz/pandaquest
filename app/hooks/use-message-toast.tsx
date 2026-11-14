import { Toast, ToastTitle, useToast } from "@/components/ui/toast";

/**
 * A short message at the top of the screen, gone after 3 seconds: for what
 * the user did (a request sent, a code copied) or why it failed. Built like
 * the XP toast and the password one, so all of them look the same.
 */
export function useMessageToast() {
  const toast = useToast();

  return function showMessage(
    message: string,
    action: "success" | "error" = "success",
  ) {
    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action={action} variant="solid">
          <ToastTitle>{message}</ToastTitle>
        </Toast>
      ),
    });
  };
}
