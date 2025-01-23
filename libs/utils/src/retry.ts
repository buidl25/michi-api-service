import { Logger } from '@nestjs/common';
import { getRandomNumber } from './general';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_FACTOR = 2;
const WAITING_TIME_MS = 1000;

export const exponentialBackoff = async <T = any>(
    query: () => Promise<T>,
    logger: Logger,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    factor = DEFAULT_FACTOR,
): Promise<T> => {
    let waitingTime = WAITING_TIME_MS;
    let attempt = 0;
  
    while (attempt < maxAttempts) {
        try {
            return await query();
        } catch (error) {
            attempt += 1;

            if (attempt >= maxAttempts) {
                logger.log('Reached max retry attempts.');
                throw error;
            }

            await sleep(waitingTime + getRandomNumber(0, 100));
            if (isThrottleError(error)) {
                waitingTime *= factor;
            }
        }
    }
  
    throw new Error('Retry loop failed unexpectedly');
};

function isThrottleError(error) {
    return error.details?.status == 429 || error.response?.status == 429;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}