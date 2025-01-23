import { 
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
    NotFoundException
} from '@nestjs/common';

@Catch()
export class UnexpectedExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(UnexpectedExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        if (!(exception instanceof NotFoundException)) {
            this.logger.error(`Exception in path ${request.url}: ${exception}`);
        }

        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        let errorResponse: any;

        if (exception instanceof HttpException) {
            errorResponse = exception.getResponse();
        } else {
            errorResponse = {
                message: 'Internal server error',
            };
        }

        const responseBody = {
            statusCode: status,
            path: request.url,
            ...errorResponse,
        };

        response.status(status).json(responseBody);
    }
}