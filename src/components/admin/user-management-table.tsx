"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserRole = "admin" | "staff";
type AccountStatus = "pending" | "active" | "suspended";
type StatusFilter = "all" | AccountStatus;
type TargetStatus = "active" | "suspended";

type PendingRoleAction = {
  user: ManagedUser;
  role: UserRole;
};

type ManagedUser = {
  id: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

type UsersResponse = {
  status: string;
  message?: string;
  data?: ManagedUser[];
};

type UpdateResponse = {
  status: string;
  message?: string;
  data?: Pick<
    ManagedUser,
    "id" | "full_name" | "role" | "status" | "updated_at"
  >;
};

type PendingAction = {
  user: ManagedUser;
  status: TargetStatus;
};

const statusOptions: {
  label: string;
  value: StatusFilter;
}[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getDisplayName(user: ManagedUser) {
  return user.full_name?.trim() || "Belum mengisi nama";
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400",
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
    suspended:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  };

  const icons = {
    pending: Clock3,
    active: CheckCircle2,
    suspended: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function UserAvatar({ user }: { user: ManagedUser }) {
  const initials =
    user.full_name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "";

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf2e9] text-sm font-semibold text-[#526b47]">
      {initials || <UserRound aria-hidden="true" className="size-5" />}
    </div>
  );
}

function UserActions({
  user,
  currentUserId,
  activeAdminCount,
  saving,
  onStatusAction,
  onRoleAction,
  mobile = false,
}: {
  user: ManagedUser;
  currentUserId: string;
  activeAdminCount: number;
  saving: boolean;
  onStatusAction: (user: ManagedUser, status: TargetStatus) => void;
  onRoleAction: (user: ManagedUser, role: UserRole) => void;
  mobile?: boolean;
}) {
  const isSelf = user.id === currentUserId;
  const isLastAdmin = user.role === "admin" && activeAdminCount <= 1;
  const buttonClass = mobile ? "min-h-11 flex-1 rounded-xl" : "h-8 rounded-xl";

  if (isSelf) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#5F705B]">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        Akun Anda (Protected)
      </span>
    );
  }

  if (user.role === "admin") {
    return (
      <div className={mobile ? "flex w-full flex-col gap-2" : "flex items-center gap-2"}>
        {isLastAdmin ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#5F705B]">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Admin terakhir (Protected)
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || user.status !== "active"}
            onClick={() => onRoleAction(user, "staff")}
            className={mobile ? "min-h-11 w-full rounded-xl" : "h-8 rounded-xl"}
          >
            Demote to Staff
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={mobile ? "flex w-full flex-col gap-2" : "flex flex-wrap justify-end gap-2"}>
      <div className={mobile ? "flex w-full gap-2" : "flex gap-2"}>
        {user.status === "pending" ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => onStatusAction(user, "active")}
              className={`${buttonClass} bg-[#687c59] text-white hover:bg-[#56694a]`}
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => onStatusAction(user, "suspended")}
              className={buttonClass}
            >
              Suspend
            </Button>
          </>
        ) : user.status === "active" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => onStatusAction(user, "suspended")}
            className={mobile ? "min-h-11 w-full rounded-xl" : "h-8 rounded-xl"}
          >
            Suspend
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => onStatusAction(user, "active")}
            className={`${mobile ? "min-h-11 w-full rounded-xl" : "h-8 rounded-xl"} bg-[#687c59] text-white hover:bg-[#56694a]`}
          >
            Reactivate
          </Button>
        )}
      </div>
      {user.status === "active" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => onRoleAction(user, "admin")}
          className={mobile ? "min-h-11 w-full rounded-xl" : "h-8 rounded-xl"}
        >
          <ShieldCheck aria-hidden="true" className="mr-1.5 size-3.5" />
          Promote to Admin
        </Button>
      )}
    </div>
  );
}

type UserManagementTableProps = {
  currentUserId: string;
};

export function UserManagementTable({ currentUserId }: UserManagementTableProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);

  const [pendingRoleAction, setPendingRoleAction] = useState<PendingRoleAction | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch users from the existing protected API
  const fetchUsers = useCallback(
    async (signal?: AbortSignal): Promise<ManagedUser[]> => {
      const response = await fetch("/api/v1/admin/users", {
        method: "GET",
        cache: "no-store",
        signal,
      });

      const result: UsersResponse = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(
          result.message || "Gagal mengambil daftar pengguna."
        );
      }

      if (!Array.isArray(result.data)) {
        throw new Error("Format data pengguna tidak valid.");
      }

      return result.data;
    },
    []
  );

  // Load users on mount
  useEffect(() => {
    const controller = new AbortController();

    async function initializeUsers() {
      try {
        const data = await fetchUsers(controller.signal);

        if (!controller.signal.aborted) {
          setUsers(data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil data."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initializeUsers();

    return () => controller.abort();
  }, [fetchUsers]);

  // Refresh the list manually
  async function refreshUsers() {
    if (refreshing || saving || loading) return;

    setRefreshing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui daftar pengguna."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const counts = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => user.status === "pending").length,
      active: users.filter((user) => user.status === "active").length,
      suspended: users.filter((user) => user.status === "suspended").length,
      activeAdmins: users.filter((user) => user.role === "admin" && user.status === "active").length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesStatus =
        filter === "all" || user.status === filter;

      const matchesSearch =
        !keyword ||
        user.full_name?.toLowerCase().includes(keyword) ||
        user.role.toLowerCase().includes(keyword) ||
        user.id.toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [users, search, filter]);

  function requestStatusChange(user: ManagedUser, status: TargetStatus) {
    setErrorMessage("");
    setSuccessMessage("");
    setPendingAction({ user, status });
  }

  // Submit account status changes
  async function confirmStatusChange() {
    if (!pendingAction || saving) return;

    const { user, status } = pendingAction;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/v1/admin/users/${encodeURIComponent(user.id)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const result: UpdateResponse = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(
          result.message || "Gagal memperbarui status akun."
        );
      }

      if (result.data) {
        const updated = result.data;

        setUsers((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          )
        );
      } else {
        const data = await fetchUsers();
        setUsers(data);
      }

      setPendingAction(null);
      setSuccessMessage(
        result.message || "Status akun berhasil diperbarui."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui status akun."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestRoleChange(user: ManagedUser, role: UserRole) {
    if (saving || user.id === currentUserId || user.status !== "active") return;
    if (role === user.role) return;
    if (user.role === "admin" && counts.activeAdmins <= 1) return;

    setErrorMessage("");
    setSuccessMessage("");
    setPendingRoleAction({ user, role });
  }

  async function confirmRoleChange() {
    if (!pendingRoleAction || saving) return;

    const { user, role } = pendingRoleAction;
    if (user.id === currentUserId || user.status !== "active" || role === user.role) {
      setPendingRoleAction(null);
      return;
    }
    if (user.role === "admin" && counts.activeAdmins <= 1) {
      setPendingRoleAction(null);
      setErrorMessage("Admin aktif terakhir tidak dapat diturunkan menjadi Staff.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/v1/admin/users/${encodeURIComponent(user.id)}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );

      const result: UpdateResponse = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "Gagal memperbarui role pengguna.");
      }

      if (result.data) {
        const updated = result.data;
        setUsers((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          )
        );
      } else {
        const data = await fetchUsers();
        setUsers(data);
      }

      setPendingRoleAction(null);
      setSuccessMessage(result.message || "Role pengguna berhasil diperbarui.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memperbarui role pengguna."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            User Management
          </h1>

        </div>

        <Button
          type="button"
          variant="outline"
          disabled={loading || refreshing || saving}
          onClick={() => void refreshUsers()}
          size="icon"
          aria-label="Muat ulang daftar pengguna"
          title="Muat ulang daftar pengguna"
          aria-busy={refreshing}
          className="size-11 shrink-0 rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {!loading && counts.pending > 0 && filter !== "pending" && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearch("");
            setFilter("pending");
          }}
          className="min-h-11 w-full justify-start gap-2 rounded-xl border-amber-200 bg-amber-50 px-3 text-amber-900 hover:bg-amber-100 hover:text-amber-950 sm:w-auto"
        >
          <Clock3 aria-hidden="true" className="size-4 shrink-0" />
          {counts.pending} akun menunggu persetujuan
        </Button>
      )}

      {/* Notifications */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">{errorMessage}</span>
        </div>
      )}

      {/* Users section */}
      <section aria-label="Daftar pengguna" className="min-w-0 overflow-hidden rounded-[26px] border border-white/55 bg-white/45 shadow-[0_10px_36px_rgba(52,59,50,0.045)] backdrop-blur-xl">
        <div className="space-y-4 border-b border-[#8FA58A]/15 bg-[#F8F6EF]/35 p-4 sm:p-5">
          {/* Search and filters */}
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5F705B]"
              />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, role, atau ID..."
                aria-label="Cari pengguna"
                className="h-11 rounded-xl border-[#8FA58A]/25 bg-white/75 pl-9 pr-12 text-base placeholder:text-[#5F705B] focus-visible:ring-[#8FA58A]/45 sm:text-sm"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setSearch("")}
                  className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-[#5F705B] hover:bg-muted hover:text-foreground"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filter status pengguna"
              className="grid min-w-0 grid-cols-2 gap-1 rounded-2xl border border-[#8FA58A]/20 bg-[#F8F6EF]/75 p-1 sm:grid-cols-4"
            >
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`min-h-11 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#8FA58A]/45 ${
                    filter === option.value
                      ? "bg-white text-[#343B32] shadow-sm"
                      : "text-[#536D50] hover:bg-white/70 hover:text-[#343B32]"
                  }`}
                >
                  {option.label}
                  {!loading && (
                    <span className="ml-1 tabular-nums">
                      ({counts[option.value === "all" ? "total" : option.value]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 px-4 text-sm text-[#5F705B]">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Memuat daftar pengguna...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
            <UsersRound
              aria-hidden="true"
              className="mb-3 size-8 text-[#5F705B]/60"
            />
            <p className="font-medium">Tidak ada pengguna ditemukan</p>
            <p className="mt-1 text-sm text-[#5F705B]">
              Coba ubah pencarian atau filter status.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile user cards */}
            <div className="space-y-3 p-3 md:hidden">
              {filteredUsers.map((user) => (
                <article key={user.id} className="space-y-4 rounded-2xl border border-[#8FA58A]/20 bg-white/65 p-3.5">
                  <div className="flex min-w-0 flex-wrap items-start gap-3">
                    <UserAvatar user={user} />

                    <div className="min-w-0 flex-[1_1_8rem]">
                      <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                        {getDisplayName(user)}
                      </p>

                      <p className="mt-1 truncate font-mono text-[11px] text-[#5F705B]">
                        {user.id}
                      </p>
                    </div>

                    <StatusBadge status={user.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F8F6EF]/85 p-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#5F705B]">
                        Role
                      </p>
                      <p className="mt-1 text-sm font-medium capitalize">
                        {user.role}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] text-[#5F705B]">
                        Terdaftar
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-9 items-center">
                    <UserActions
                      user={user}
                      saving={saving}
                      currentUserId={currentUserId}
                      activeAdminCount={counts.activeAdmins}
                      onStatusAction={requestStatusChange}
                      onRoleAction={requestRoleChange}
                      mobile
                    />
                  </div>
                </article>
              ))}
            </div>

            {/* Tablet and desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[#8FA58A]/15 bg-[#F8F6EF]/65">
                  <tr className="text-xs text-[#5F705B]">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Pengguna
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Terdaftar
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Tindakan
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#8FA58A]/15">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-white/60"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={user} />

                          <div className="min-w-0">
                            <p className="max-w-48 truncate font-semibold">
                              {getDisplayName(user)}
                            </p>
                            <p className="mt-1 max-w-40 truncate font-mono text-[11px] text-[#5F705B]">
                              {user.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-medium capitalize">
                          {user.role}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={user.status} />
                      </td>

                      <td className="px-4 py-4 text-[#5F705B]">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <UserActions
                            user={user}
                            saving={saving}
                            currentUserId={currentUserId}
                            activeAdminCount={counts.activeAdmins}
                            onStatusAction={requestStatusChange}
                            onRoleAction={requestRoleChange}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && (
          <div className="border-t border-[#8FA58A]/15 px-4 py-3 text-xs text-[#5F705B] sm:px-5">
            Menampilkan {filteredUsers.length} dari {users.length} akun
          </div>
        )}
      </section>

      {/* Confirmation dialog */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingAction(null);
        }}
      >
        <DialogContent
          showCloseButton={!saving}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (saving) event.preventDefault();
          }}
          className="w-[calc(100%-2rem)] max-w-md rounded-[26px] border-[#8FA58A]/20 bg-[#FCFBF7] p-5 sm:p-6"
        >
          {pendingAction && (
            <>
              <DialogHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#edf1e8]">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-5 text-[#687c59]"
                  />
                </div>

                <DialogTitle>
                  {pendingAction.status === "active"
                    ? pendingAction.user.status === "pending"
                      ? "Setujui akun ini?"
                      : "Aktifkan kembali akun?"
                    : "Tangguhkan akun ini?"}
                </DialogTitle>

                <DialogDescription className="leading-6">
                  {pendingAction.status === "active"
                    ? "Pengguna akan mendapatkan akses ke PantryOven sesuai role Staff."
                    : "Pengguna tidak dapat mengakses Dashboard sampai akunnya diaktifkan kembali."}
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 rounded-xl bg-[#F8F6EF] p-3">
                <p className="truncate text-sm font-semibold">
                  {getDisplayName(pendingAction.user)}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#5F705B]">
                  {pendingAction.user.id}
                </p>
              </div>

              <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setPendingAction(null)}
                  className="min-h-11 w-full sm:w-auto rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                >
                  Batal
                </Button>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmStatusChange()}
                  className={`min-h-11 w-full rounded-xl sm:w-auto ${
                    pendingAction.status === "active"
                      ? "bg-[#687c59] text-white hover:bg-[#56694a]"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {saving && (
                    <Loader2
                      aria-hidden="true"
                      className="mr-2 size-4 animate-spin"
                    />
                  )}

                  {pendingAction.status === "active"
                    ? "Konfirmasi Aktivasi"
                    : "Konfirmasi Suspend"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Role change confirmation */}
      <Dialog
        open={pendingRoleAction !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingRoleAction(null);
        }}
      >
        <DialogContent
          showCloseButton={!saving}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (saving) event.preventDefault();
          }}
          className="w-[calc(100%-2rem)] max-w-md rounded-[26px] border-[#8FA58A]/20 bg-[#FCFBF7] p-5 sm:p-6"
        >
          {pendingRoleAction && (
            <>
              <DialogHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#edf1e8]">
                  <ShieldCheck aria-hidden="true" className="size-5 text-[#687c59]" />
                </div>
                <DialogTitle>
                  {pendingRoleAction.role === "admin"
                    ? "Promote menjadi Admin?"
                    : "Demote menjadi Staff?"}
                </DialogTitle>
                <DialogDescription className="leading-6">
                  {pendingRoleAction.role === "admin"
                    ? "Pengguna akan memperoleh akses Administrator untuk mengelola akun dan fitur administratif PantryOven."
                    : "Pengguna akan kehilangan akses Administrator dan kembali memiliki akses Staff."}
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 rounded-xl bg-[#F8F6EF] p-3">
                <p className="truncate text-sm font-semibold">
                  {getDisplayName(pendingRoleAction.user)}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#5F705B]">
                  {pendingRoleAction.user.id}
                </p>
                <p className="mt-2 text-xs font-medium capitalize">
                  {pendingRoleAction.user.role} → {pendingRoleAction.role}
                </p>
              </div>

              <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setPendingRoleAction(null)}
                  className="min-h-11 w-full sm:w-auto rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmRoleChange()}
                  className="min-h-11 w-full rounded-xl bg-[#687c59] text-white hover:bg-[#56694a] sm:w-auto"
                >
                  {saving && (
                    <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                  )}
                  {pendingRoleAction.role === "admin"
                    ? "Konfirmasi Promote"
                    : "Konfirmasi Demote"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}