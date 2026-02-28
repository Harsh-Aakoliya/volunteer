// api/chat/polls.ts
import { api, apiUrl } from "@/api/apiClient";

export const createPoll = async (data: {
  question: string;
  options: { id: string; text: string }[];
  isMultipleChoiceAllowed: boolean;
  pollEndTime: string | null;
  roomId: string | number;
  createdBy: string;
}) => {
  const response = await api.post(apiUrl("/api/poll"), data);
  return response.data;
};

export const getPoll = async (pollId: number) => {
  const response = await api.get(apiUrl(`/api/poll/${pollId}`));
  return response.data;
};

export const votePoll = async (
  pollId: number,
  userId: string,
  selectedOptions: string[]
) => {
  const response = await api.post(apiUrl(`/api/poll/${pollId}/vote`), {
    userId,
    selectedOptions,
  });
  return response.data;
};

export const getPollVotesDetails = async (
  pollId: number,
  userId: string
) => {
  const response = await api.get(apiUrl(`/api/poll/${pollId}/votes-details`), {
    params: { userId },
  });
  return response.data;
};

export const togglePollStatus = async (pollId: number, userId: string) => {
  const response = await api.patch(apiUrl(`/api/poll/${pollId}/toggle`), {
    userId,
  });
  return response.data;
};

export const reactivatePoll = async (
  pollId: number,
  userId: string,
  pollEndTime: string
) => {
  const response = await api.patch(apiUrl(`/api/poll/${pollId}/reactivate`), {
    userId,
    pollEndTime,
  });
  return response.data;
};
