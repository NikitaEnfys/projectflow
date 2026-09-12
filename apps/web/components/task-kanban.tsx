"use client";

import { apiFetch } from "@/lib/api/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRef = {
  id: string;
  name: string;
  email: string;
};

type MemberRef = UserRef & {
  role: string;
};

type ApprovalCandidate = UserRef & {
  source: string;
  clientApprover?: boolean;
};

type TaskPermissions = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  canModerateComments: boolean;
  canConfigureApproval: boolean;
  canSubmitForApproval: boolean;
  canDecideApproval: boolean;
};

type MilestoneRef = {
  id: string;
  name: string;
};

type Comment = {
  id: string;
  content: string;
  visibility: string;
  createdAt: string;
  authorId: string;
  author: UserRef;
};

type Approval = {
  id: string;
  approverId: string;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  decidedAt: string | null;
  approver: UserRef;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  clientVisible: boolean;
  requiresApproval: boolean;
  permissions: TaskPermissions;
  myApproval: Approval | null;
  assigneeId: string | null;
  creatorId: string;
  milestoneId: string | null;
  assignee: UserRef | null;
  creator: UserRef;
  milestone: MilestoneRef | null;
  comments: Comment[];
  approvals: Approval[];
};

type Props = {
  projectId: string;
  tasks: Task[];
  members: MemberRef[];
  approvalCandidates: ApprovalCandidate[];
  milestones: MilestoneRef[];
  canManage: boolean;
  clientViewer: boolean;
  currentUserId: string;
};

const COLUMNS = [
  ["TODO", "Teendő"],
  ["IN_PROGRESS", "Folyamatban"],
  ["REVIEW", "Ellenőrzés"],
  ["AWAITING_APPROVAL", "Jóváhagyásra vár"],
  ["BLOCKED", "Blokkolt"],
  ["DONE", "Kész"],
] as const;

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Alacsony",
  MEDIUM: "Közepes",
  HIGH: "Magas",
  URGENT: "Sürgős",
};

const ROLE_LABELS: Record<string, string> = {
  PROJECT_MANAGER: "Projektvezető",
  MEMBER: "Belső munkatárs",
  CONTRACTOR: "Alvállalkozó",
};

const DECISION_LABELS: Record<string, string> = {
  PENDING: "Függőben",
  APPROVED: "Jóváhagyva",
  REJECTED: "Elutasítva",
};

function dateValue(value: string | null) {
  return value
    ? new Date(value).toISOString().slice(0, 10)
    : "";
}

export function TaskKanban({
  projectId,
  tasks,
  members,
  approvalCandidates,
  milestones,
  canManage,
  clientViewer,
  currentUserId,
}: Props) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedTaskId, setSelectedTaskId] =
    useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    assigneeId: "",
    milestoneId: "",
    clientVisible: false,
  });

  const [edit, setEdit] = useState({
    title: "",
    description: "",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "",
    assigneeId: "",
    milestoneId: "",
    clientVisible: false,
  });

  const [comment, setComment] = useState("");
  const [commentVisibility, setCommentVisibility] =
    useState("INTERNAL");

  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] =
    useState("");

  const [requiresApproval, setRequiresApproval] =
    useState(false);
  const [approvalIds, setApprovalIds] = useState<string[]>(
    [],
  );
  const [approvalCandidateId, setApprovalCandidateId] =
    useState("");
  const [rejectionComment, setRejectionComment] =
    useState("");

  const selected =
    tasks.find((task) => task.id === selectedTaskId) ??
    null;

  const byStatus = useMemo(
    () =>
      Object.fromEntries(
        COLUMNS.map(([status]) => [
          status,
          tasks.filter(
            (task) => task.status === status,
          ),
        ]),
      ),
    [tasks],
  );

  async function api(
    url: string,
    init: RequestInit,
  ) {
    const response = await apiFetch(url, init);

    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => null);

      throw new Error(
        data?.error ||
          data?.details ||
          "A művelet nem sikerült.",
      );
    }

    return response;
  }

  async function createTask(
    event: React.FormEvent,
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: "",
        assigneeId: "",
        milestoneId: "",
        clientVisible: false,
      });

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openTask(task: Task) {
    setSelectedTaskId(task.id);

    setEdit({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: dateValue(task.dueDate),
      assigneeId: task.assigneeId || "",
      milestoneId: task.milestoneId || "",
      clientVisible: task.clientVisible,
    });

    setComment("");
    setCommentVisibility("INTERNAL");
    setEditingCommentId(null);
    setRequiresApproval(task.requiresApproval);
    setApprovalIds(
      task.approvals.map(
        (approval) => approval.approverId,
      ),
    );
    setApprovalCandidateId("");
    setRejectionComment("");
    setError("");
  }

  async function saveEdit() {
    if (!selected) return;

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(edit),
        },
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function moveTask(
    task: Task,
    status: string,
  ) {
    if (clientViewer) return;
    if (task.status === status) return;

    if (!task.permissions.canChangeStatus) return;

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeTask(task: Task) {
    if (
      !confirm(
        `Biztosan törlöd a(z) „${task.title}” feladatot?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" },
      );

      setSelectedTaskId(null);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addComment(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!selected || !comment.trim()) return;

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: comment,
            visibility: clientViewer
              ? "CLIENT_VISIBLE"
              : commentVisibility,
          }),
        },
      );

      setComment("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  function beginEditComment(item: Comment) {
    setEditingCommentId(item.id);
    setEditingCommentText(item.content);
  }

  async function saveComment(commentId: string) {
    if (!selected || !editingCommentText.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: editingCommentText,
          }),
        },
      );

      setEditingCommentId(null);
      setEditingCommentText("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (
      !selected ||
      !confirm(
        "Biztosan törlöd ezt a kommentet?",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/comments/${commentId}`,
        { method: "DELETE" },
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  function addApprover() {
    if (
      !approvalCandidateId ||
      approvalIds.includes(
        approvalCandidateId,
      )
    ) {
      return;
    }

    setApprovalIds((current) => [
      ...current,
      approvalCandidateId,
    ]);
    setApprovalCandidateId("");
  }

  async function saveApprovalConfig() {
    if (!selected) return;

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/approvals/config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requiresApproval,
            approverIds: requiresApproval
              ? approvalIds
              : [],
          }),
        },
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitForApproval() {
    if (!selected) return;

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/approvals/submit`,
        { method: "POST" },
      );

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decideApproval(
    approval: Approval,
    decision: "APPROVED" | "REJECTED",
  ) {
    if (!selected) return;

    if (
      decision === "REJECTED" &&
      !rejectionComment.trim()
    ) {
      setError(
        "Elutasításkor írj rövid indoklást.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/projects/${projectId}/tasks/${selected.id}/approvals/${approval.id}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            comment:
              decision === "REJECTED"
                ? rejectionComment
                : null,
          }),
        },
      );

      setRejectionComment("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pf-card mb-7 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">
          Feladatok és Kanban
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Feladatok, kommentek és jóváhagyások egy helyen.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">
          {error}
        </p>
      )}

      {canManage && !clientViewer && (
        <form
          onSubmit={createTask}
          className="mb-7 grid gap-3 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <input
            className="rounded-xl border bg-white p-3 xl:col-span-2"
            placeholder="Feladat címe"
            value={form.title}
            onChange={(event) =>
              setForm({
                ...form,
                title: event.target.value,
              })
            }
          />

          <select
            className="rounded-xl border bg-white p-3"
            value={form.priority}
            onChange={(event) =>
              setForm({
                ...form,
                priority: event.target.value,
              })
            }
          >
            <option value="LOW">Alacsony</option>
            <option value="MEDIUM">Közepes</option>
            <option value="HIGH">Magas</option>
            <option value="URGENT">Sürgős</option>
          </select>

          <input
            type="date"
            className="rounded-xl border bg-white p-3"
            value={form.dueDate}
            onChange={(event) =>
              setForm({
                ...form,
                dueDate: event.target.value,
              })
            }
          />

          <textarea
            className="rounded-xl border bg-white p-3 md:col-span-2"
            rows={2}
            placeholder="Leírás"
            value={form.description}
            onChange={(event) =>
              setForm({
                ...form,
                description: event.target.value,
              })
            }
          />

          <select
            className="rounded-xl border bg-white p-3"
            value={form.assigneeId}
            onChange={(event) =>
              setForm({
                ...form,
                assigneeId: event.target.value,
              })
            }
          >
            <option value="">Nincs felelős</option>
            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {member.name} ·{" "}
                {ROLE_LABELS[member.role] ??
                  member.role}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border bg-white p-3"
            value={form.milestoneId}
            onChange={(event) =>
              setForm({
                ...form,
                milestoneId: event.target.value,
              })
            }
          >
            <option value="">
              Nincs mérföldkő
            </option>
            {milestones.map((milestone) => (
              <option
                key={milestone.id}
                value={milestone.id}
              >
                {milestone.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.clientVisible}
              onChange={(event) =>
                setForm({
                  ...form,
                  clientVisible:
                    event.target.checked,
                })
              }
            />
            Ügyfél számára látható
          </label>

          <button
            disabled={
              busy || !form.title.trim()
            }
            className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            + Feladat
          </button>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-6">
        {COLUMNS.map(([status, label]) => (
          <div
            key={status}
            className="min-w-0 rounded-lg border bg-[#f8f9fc] p-3"
            onDragOver={(event) => {
              if (!clientViewer) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              if (clientViewer) return;

              const id =
                event.dataTransfer.getData(
                  "text/task-id",
                );

              const task = tasks.find(
                (item) => item.id === id,
              );

              if (task) {
                moveTask(task, status);
              }
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {label}
              </h3>
              <span className="rounded-full border px-2 py-0.5 text-xs">
                {byStatus[status]?.length || 0}
              </span>
            </div>

            <div className="grid gap-3">
              {byStatus[status]?.map(
                (task: Task) => {
                  const movable =
                    task.permissions.canChangeStatus;

                  return (
                    <article
                      key={task.id}
                      draggable={
                        movable && !busy
                      }
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "text/task-id",
                          task.id,
                        )
                      }
                      className="rounded-lg border bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() =>
                            openTask(task)
                          }
                        >
                          {task.title}
                        </button>

                        <span className="text-[10px] uppercase text-gray-500">
                          {
                            PRIORITY_LABELS[
                              task.priority
                            ]
                          }
                        </span>
                      </div>

                      {task.description && (
                        <p className="mt-2 line-clamp-3 text-xs text-gray-600">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-3 grid gap-1 text-xs text-gray-500">
                        <span>
                          Felelős:{" "}
                          {task.assignee?.name ||
                            "nincs"}
                        </span>
                        <span>
                          Határidő:{" "}
                          {task.dueDate
                            ? new Date(
                                task.dueDate,
                              ).toLocaleDateString(
                                "hu-HU",
                              )
                            : "nincs"}
                        </span>
                        <span>
                          Kommentek:{" "}
                          {task.comments.length}
                        </span>
                        {task.permissions.canDecideApproval ? (
                          <span className="font-semibold text-[#b26a00]">
                            Jóváhagyás rád vár
                          </span>
                        ) : task.requiresApproval ? (
                          <span className="font-medium text-[#5965df]">
                            Jóváhagyás szükséges
                          </span>
                        ) : null}
                      </div>

                      {movable && (
                        <select
                          disabled={busy}
                          className="mt-3 w-full rounded-lg border bg-white p-2 text-xs"
                          value={task.status}
                          onChange={(event) =>
                            moveTask(
                              task,
                              event.target.value,
                            )
                          }
                        >
                          {COLUMNS.filter(
                            ([candidate]) =>
                              candidate !==
                              "AWAITING_APPROVAL",
                          ).map(
                            ([
                              candidate,
                              candidateLabel,
                            ]) => (
                              <option
                                key={candidate}
                                value={candidate}
                              >
                                {candidateLabel}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </article>
                  );
                },
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-6 rounded-xl border p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">
                {selected.title}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Létrehozta:{" "}
                {selected.creator.name}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedTaskId(null)
              }
              className="text-sm"
            >
              Bezárás
            </button>
          </div>

          {selected.permissions.canEdit ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                className="rounded-xl border bg-white p-3 xl:col-span-2"
                value={edit.title}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    title: event.target.value,
                  })
                }
              />

              <select
                className="rounded-xl border bg-white p-3"
                value={edit.status}
                disabled={
                  selected.status ===
                  "AWAITING_APPROVAL"
                }
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    status: event.target.value,
                  })
                }
              >
                {COLUMNS.filter(
                  ([status]) =>
                    status !==
                    "AWAITING_APPROVAL",
                ).map(([status, label]) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border bg-white p-3"
                value={edit.priority}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    priority:
                      event.target.value,
                  })
                }
              >
                <option value="LOW">
                  Alacsony
                </option>
                <option value="MEDIUM">
                  Közepes
                </option>
                <option value="HIGH">
                  Magas
                </option>
                <option value="URGENT">
                  Sürgős
                </option>
              </select>

              <textarea
                className="rounded-xl border bg-white p-3 md:col-span-2"
                rows={3}
                value={edit.description}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    description:
                      event.target.value,
                  })
                }
              />

              <input
                type="date"
                className="rounded-xl border bg-white p-3"
                value={edit.dueDate}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    dueDate:
                      event.target.value,
                  })
                }
              />

              <select
                className="rounded-xl border bg-white p-3"
                value={edit.assigneeId}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    assigneeId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Nincs felelős
                </option>
                {members.map((member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.name} ·{" "}
                    {ROLE_LABELS[
                      member.role
                    ] ?? member.role}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl border bg-white p-3"
                value={edit.milestoneId}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    milestoneId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Nincs mérföldkő
                </option>
                {milestones.map(
                  (milestone) => (
                    <option
                      key={milestone.id}
                      value={milestone.id}
                    >
                      {milestone.name}
                    </option>
                  ),
                )}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    edit.clientVisible
                  }
                  onChange={(event) =>
                    setEdit({
                      ...edit,
                      clientVisible:
                        event.target.checked,
                    })
                  }
                />
                Ügyfél számára látható
              </label>

              <div className="flex gap-2">
                <button
                  disabled={
                    busy ||
                    !edit.title.trim() ||
                    selected.status ===
                      "AWAITING_APPROVAL"
                  }
                  onClick={saveEdit}
                  className="rounded-lg bg-[#5b67f1] px-4 py-2 text-white disabled:opacity-50"
                >
                  Mentés
                </button>

                {selected.permissions.canDelete && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      removeTask(selected)
                    }
                    className="rounded-lg border px-4 py-2"
                  >
                    Törlés
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 text-sm">
              <p>
                {selected.description ||
                  "Nincs leírás."}
              </p>
              <p className="text-gray-500">
                Felelős:{" "}
                {selected.assignee?.name ||
                  "nincs"}
              </p>
              <p className="text-gray-500">
                Határidő:{" "}
                {selected.dueDate
                  ? new Date(
                      selected.dueDate,
                    ).toLocaleDateString(
                      "hu-HU",
                    )
                  : "nincs"}
              </p>
            </div>
          )}

          {selected.permissions.canConfigureApproval && (
            <div className="mt-6 border-t border-[#edf0f5] pt-5">
              <h4 className="font-semibold">
                Jóváhagyási beállítások
              </h4>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  disabled={
                    selected.status ===
                    "AWAITING_APPROVAL"
                  }
                  onChange={(event) =>
                    setRequiresApproval(
                      event.target.checked,
                    )
                  }
                />
                A feladat csak jóváhagyás után lehet Kész
              </label>

              {requiresApproval && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={approvalCandidateId}
                      onChange={(event) =>
                        setApprovalCandidateId(
                          event.target.value,
                        )
                      }
                      className="min-w-0 flex-1 rounded-xl border bg-white p-3"
                    >
                      <option value="">
                        Válassz jóváhagyót…
                      </option>

                      {approvalCandidates
                        .filter(
                          (candidate) =>
                            !approvalIds.includes(
                              candidate.id,
                            ),
                        )
                        .map(
                          (candidate) => (
                            <option
                              key={
                                candidate.id
                              }
                              value={
                                candidate.id
                              }
                            >
                              {candidate.name} ·{" "}
                              {candidate.source}
                            </option>
                          ),
                        )}
                    </select>

                    <button
                      type="button"
                      onClick={addApprover}
                      disabled={
                        !approvalCandidateId
                      }
                      className="pf-button-secondary disabled:opacity-50"
                    >
                      Hozzáadás
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {approvalIds.map((id) => {
                      const candidate =
                        approvalCandidates.find(
                          (item) =>
                            item.id === id,
                        );

                      return (
                        <span
                          key={id}
                          className="pf-chip flex items-center gap-2"
                        >
                          {candidate?.name ??
                            id}
                          <button
                            type="button"
                            disabled={
                              selected.status ===
                              "AWAITING_APPROVAL"
                            }
                            onClick={() =>
                              setApprovalIds(
                                (current) =>
                                  current.filter(
                                    (
                                      currentId,
                                    ) =>
                                      currentId !==
                                      id,
                                  ),
                              )
                            }
                            aria-label="Jóváhagyó eltávolítása"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    busy ||
                    selected.status ===
                      "AWAITING_APPROVAL"
                  }
                  onClick={
                    saveApprovalConfig
                  }
                  className="pf-button-secondary disabled:opacity-50"
                >
                  Jóváhagyási beállítások mentése
                </button>

                {selected.permissions.canSubmitForApproval && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={
                        submitForApproval
                      }
                      className="pf-button-primary disabled:opacity-50"
                    >
                      Jóváhagyásra küldés
                    </button>
                  )}
              </div>
            </div>
          )}

          {selected.permissions.canDecideApproval &&
            selected.myApproval && (
              <div className="mt-6 rounded-xl border border-[#d9defb] bg-[#f7f8ff] p-5">
                <p className="pf-eyebrow">
                  Te vagy a jóváhagyó
                </p>
                <h4 className="mt-1 text-lg font-bold text-[#30384b]">
                  Döntés szükséges
                </h4>
                <p className="mt-2 text-sm leading-6 text-[#667084]">
                  A csapat ezt a feladatot jóváhagyásra küldte neked.
                </p>

                <textarea
                  rows={2}
                  className="mt-4 w-full rounded-xl border bg-white p-3 text-sm"
                  value={rejectionComment}
                  onChange={(event) =>
                    setRejectionComment(
                      event.target.value,
                    )
                  }
                  placeholder="Elutasítás indoklása (elutasításkor kötelező)"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      decideApproval(
                        selected.myApproval!,
                        "APPROVED",
                      )
                    }
                    className="rounded-lg bg-[#187555] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Jóváhagyom
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      decideApproval(
                        selected.myApproval!,
                        "REJECTED",
                      )
                    }
                    className="rounded-lg border border-[#efc9cf] bg-[#fff7f8] px-4 py-2 text-sm font-semibold text-[#b33d50] disabled:opacity-50"
                  >
                    Visszaküldöm javításra
                  </button>
                </div>
              </div>
            )}

          {selected.requiresApproval && (
            <div className="mt-6 border-t border-[#edf0f5] pt-5">
              <h4 className="font-semibold">
                Jóváhagyások
              </h4>

              <div className="mt-3 space-y-3">
                {selected.approvals.map(
                  (approval) => (
                    <div
                      key={approval.id}
                      className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#3d4659]">
                            {
                              approval
                                .approver
                                .name
                            }
                          </p>
                          <p className="text-xs text-[#8993a5]">
                            {
                              approval
                                .approver
                                .email
                            }
                          </p>
                        </div>

                        <span className="pf-chip">
                          {
                            DECISION_LABELS[
                              approval
                                .decision
                            ]
                          }
                        </span>
                      </div>

                      {approval.comment && (
                        <p className="mt-3 text-sm text-[#667084]">
                          {
                            approval.comment
                          }
                        </p>
                      )}


                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {!selected.permissions.canConfigureApproval &&
            selected.permissions.canSubmitForApproval && (
              <div className="mt-6 border-t border-[#edf0f5] pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={submitForApproval}
                  className="pf-button-primary disabled:opacity-50"
                >
                  Jóváhagyásra küldés
                </button>
              </div>
            )}

          <div className="mt-6 border-t border-[#edf0f5] pt-5">
            <h4 className="font-semibold">
              Kommentek
            </h4>

            <div className="mt-3 grid gap-3">
              {selected.comments.length ===
              0 ? (
                <p className="text-sm text-gray-500">
                  Még nincs komment.
                </p>
              ) : (
                selected.comments.map(
                  (item) => {
                    const canEditComment =
                      selected.permissions.canModerateComments ||
                      item.authorId ===
                        currentUserId;

                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#3f485b]">
                              {
                                item.author
                                  .name
                              }
                            </p>
                            <p className="mt-1 text-[11px] text-[#929baa]">
                              {new Date(
                                item.createdAt,
                              ).toLocaleString(
                                "hu-HU",
                              )}
                              {" · "}
                              {item.visibility ===
                              "CLIENT_VISIBLE"
                                ? "Ügyfélnek látható"
                                : "Belső"}
                            </p>
                          </div>

                          {canEditComment && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#5965df]"
                                onClick={() =>
                                  beginEditComment(
                                    item,
                                  )
                                }
                              >
                                Szerkesztés
                              </button>
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#b33d50]"
                                onClick={() =>
                                  deleteComment(
                                    item.id,
                                  )
                                }
                              >
                                Törlés
                              </button>
                            </div>
                          )}
                        </div>

                        {editingCommentId ===
                        item.id ? (
                          <div className="mt-3">
                            <textarea
                              className="w-full rounded-xl border bg-white p-3 text-sm"
                              rows={3}
                              value={
                                editingCommentText
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditingCommentText(
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  !editingCommentText.trim()
                                }
                                onClick={() =>
                                  saveComment(
                                    item.id,
                                  )
                                }
                                className="pf-button-primary disabled:opacity-50"
                              >
                                Mentés
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCommentId(
                                    null,
                                  )
                                }
                                className="pf-button-secondary"
                              >
                                Mégse
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5e687a]">
                            {item.content}
                          </p>
                        )}
                      </article>
                    );
                  },
                )
              )}
            </div>

            {selected.permissions.canComment && (
            <form
              onSubmit={addComment}
              className="mt-4 space-y-3"
            >
              <textarea
                className="w-full rounded-xl border bg-white p-3 text-sm"
                rows={3}
                value={comment}
                onChange={(event) =>
                  setComment(
                    event.target.value,
                  )
                }
                placeholder={
                  clientViewer
                    ? "Írj kommentet az ügyfélbeszélgetéshez…"
                    : "Írj kommentet…"
                }
              />

              <div className="flex flex-wrap items-center gap-3">
                {!clientViewer && (
                  <select
                    className="rounded-xl border bg-white p-2.5 text-sm"
                    value={
                      commentVisibility
                    }
                    onChange={(event) =>
                      setCommentVisibility(
                        event.target.value,
                      )
                    }
                  >
                    <option value="INTERNAL">
                      Belső komment
                    </option>
                    {selected.clientVisible && (
                      <option value="CLIENT_VISIBLE">
                        Ügyfélnek látható
                      </option>
                    )}
                  </select>
                )}

                <button
                  disabled={
                    busy || !comment.trim()
                  }
                  className="pf-button-primary disabled:opacity-50"
                >
                  Komment küldése
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
