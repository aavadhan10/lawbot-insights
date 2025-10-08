import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const NoOrganizationWarning = () => {
  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Organization Required</AlertTitle>
        <AlertDescription>
          Your account is not currently assigned to an organization. Please contact your administrator to be added to an organization before you can use Briefly AI Assistant.
        </AlertDescription>
      </Alert>
    </div>
  );
};
