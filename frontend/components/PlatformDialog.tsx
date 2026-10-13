import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";

const formSchema = z.object({
  name: z.string().trim().min(1),
  abbreviation: z.string().trim().max(50),
});

export type PlatformFormValues = z.infer<typeof formSchema>;

interface PlatformDialogProps {
  open: boolean;
  title: string;
  defaultValues?: { name: string; abbreviation: string | null };
  onClose: () => void;
  onSubmit: (values: { name: string; abbreviation: string | null }) => void;
  submitLabel: string;
}

const PlatformDialog = ({ open, title, defaultValues, onClose, onSubmit, submitLabel }: PlatformDialogProps) => {
  const { t } = useTranslation();

  const defaults: PlatformFormValues = {
    name: defaultValues?.name ?? "",
    abbreviation: defaultValues?.abbreviation ?? "",
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlatformFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFormSubmit = (values: PlatformFormValues) => {
    const abbreviation = values.abbreviation.trim();
    onSubmit({
      name: values.name.trim(),
      abbreviation: abbreviation.length > 0 ? abbreviation : null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                autoFocus
                label={t("settings.platformManager.nameColumn")}
                required
                error={Boolean(errors.name)}
                helperText={errors.name?.message ?? t("common.required")}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth sx={{ margin: "0 0 10px 0" }}>
          <Controller
            name="abbreviation"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("settings.platformManager.abbreviationColumn")}
                error={Boolean(errors.abbreviation)}
                helperText={errors.abbreviation?.message ?? t("settings.platformManager.abbreviationHint")}
              />
            )}
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit(handleFormSubmit)} color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlatformDialog;
