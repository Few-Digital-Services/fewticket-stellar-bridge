import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';


@Injectable()
export class BridgeClient {
  private api: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private environment: string;
  

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get<string>('BRIDGE_ENVIRONMENT') || 'sandbox';
    this.apiKey = this.configService.get<string>(`BRIDGE_${this.environment.toUpperCase()}_API_KEY`)!;
    this.baseUrl = this.configService.get<string>(`BRIDGE_${this.environment.toUpperCase()}_BASE_URL`)!;

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Api-Key': this.apiKey,
      },
    });
  }

 

  // Safe call wrapper
  private async safeCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      console.error('Bridge API error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Bridge API call failed',
      );
    }
  }

  // POST request with HMAC signing
  public async post( endpoint: string, idempotencyKey: string, body: any = {}) {

    const headers = {
      'idempotency-key': idempotencyKey,
    };

    return this.safeCall(async () => {
      const response = await this.api.post(endpoint, body, { headers });
      return response.data;
    });
  }

   public async put( endpoint: string, body: any = {}, params: any = {}) {

    const headers = {
      
    };

    return this.safeCall(async () => {
      const response = await this.api.put(endpoint, body, { headers, params });
      return response.data;
    });
  }


    public async delete( endpoint: string, body: any = {}, params: any = {}) {
    const headers = {  
    };
    return this.safeCall(async () => {
      const response = await this.api.delete(endpoint, { headers, params });
      return response.data;
    });
  }



  public async get(endpoint: string, idempotencyKey: string, params: any = {}) {
    const headers = {
    };

    return this.safeCall(async () => {
      const response = await this.api.get(endpoint, { headers, params });
      return response.data;
    });
  }


  
}
