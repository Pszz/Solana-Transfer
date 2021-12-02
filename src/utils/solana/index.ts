import BigNumber from 'bignumber.js';
import * as SPL from '@solana/spl-token';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  Cluster,
  Keypair,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

interface ITransferProps {
  from: string;
  to: string;
  tokenAddress: string;
  amount: BigNumber;
}
class SolWallet {
  private wallet: any = null;
  private connection: Connection;

  constructor(cluster: Cluster) {
    this.connection = new Connection(clusterApiUrl(cluster), 'recent');
  }

  initWallet() {
    // solana钱包插件
    if (window?.solana && this.wallet === null) {
      this.wallet = window?.solana;
    }
  }
  /**
   * 链接钱包
   */
  async handleConnect() {
    this.initWallet();
    if (this.wallet?.isConnected && this.wallet?.publicKey) {
      return {
        isConnected: true,
        publicKey: this.wallet.publicKey.toString(),
      };
    }
    try {
      const _wallet = await this.wallet.connect();
      return {
        isConnected: true,
        publicKey: _wallet.publicKey.toString(),
      };
    } catch (err) {
      return Promise.reject(`Connect error:${err}`);
    }
  }
  /**
   * 断开链接钱包
   */
  async handleDisConnect() {
    try {
      return await this.wallet.disconnect();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /**
   * 查询当前钱包某个Token余额
   * @param tokenAccount Token账户
   */
  async getTokenBalance(tokenAccount: PublicKey) {
    return await this.connection.getTokenAccountBalance(tokenAccount);
  }
  /**
   * 获取Token Account信息
   * @param tokenAddress Token代币地址
   * @returns Token账户
   */
  async getTokenAccount(
    tokenAddress: PublicKey,
    whoAddress: PublicKey,
  ): Promise<PublicKey> {
    return await SPL.Token.getAssociatedTokenAddress(
      SPL.ASSOCIATED_TOKEN_PROGRAM_ID,
      SPL.TOKEN_PROGRAM_ID,
      tokenAddress,
      whoAddress,
    );
  }
  /**
   * 向钱包发出请求
   * @param instructions 需要签名的结构
   * @param feePayer 手续费支付者
   * @returns Tx
   */
  async sendTransation(
    instructions: TransactionInstruction[],
    feePayer: PublicKey,
  ) {
    const transaction = new Transaction();

    instructions.forEach((v) => {
      transaction.add(v);
    });

    try {
      transaction.feePayer = feePayer;
      transaction.recentBlockhash = (
        await this.connection.getRecentBlockhash('max')
      ).blockhash;
      // 签名
      const sign = await this.wallet.signTransaction(transaction);
      // 发起
      return await this.connection.sendRawTransaction(sign.serialize());
    } catch (err) {
      console.log(err);
      return Promise.reject(`transfer error:${err}`);
    }
  }
  /**
   * Token 转账
   * @param param0
   */
  async transferToken({ from, to, amount, tokenAddress }: ITransferProps) {
    const _from: PublicKey = new PublicKey(from);
    const _to: PublicKey = new PublicKey(to);
    // 创建交易实例
    const transaction = new Transaction();

    // 手续费支付者
    transaction.feePayer = _from;
    if (!tokenAddress) Promise.reject('tokenAddress Required');
    const ERC20_TOKEN = new PublicKey(tokenAddress);
    // Token Account代币
    const fromTokenAccount = await this.getTokenAccount(ERC20_TOKEN, _from);
    const toTokenAccount = await this.getTokenAccount(ERC20_TOKEN, _to);

    console.log('token:', ERC20_TOKEN.toString());
    console.log('from:', fromTokenAccount.toString(), _from.toString());
    console.log('to:', toTokenAccount.toString(), _to.toString());

    const instructions: TransactionInstruction[] = [];
    const toAccount = SystemProgram.createAccount({
      fromPubkey: this.wallet.publicKey, // 付款人地址
      newAccountPubkey: toTokenAccount, // 收款人Account
      lamports: await this.connection.getMinimumBalanceForRentExemption(
        SPL.AccountLayout.span,
      ),
      space: SPL.AccountLayout.span,
      programId: SPL.TOKEN_PROGRAM_ID,
    });
    // 初始化账户指令 => 相当于银行卡给对方
    const instruction = SPL.Token.createInitAccountInstruction(
      SPL.TOKEN_PROGRAM_ID,
      ERC20_TOKEN,
      toTokenAccount,
      _to,
    );
    instructions.push(toAccount);
    instructions.push(instruction);

    // 初始化交易指令 => 准备打钱给对方
    const transfer = SPL.Token.createTransferInstruction(
      SPL.TOKEN_PROGRAM_ID,
      fromTokenAccount,
      toTokenAccount,
      _from,
      [],
      amount.multipliedBy(1e9).toNumber(),
    );
    console.log('amount:', amount.multipliedBy(1e9).toNumber());
    instructions.push(transfer);

    return this.sendTransation(instructions, _from);
  }
  /**
   * Transfer
   * @params { from: 转账Token，to：接收Token，amout:金额}
   * @returns
   */
  async transfer(props: ITransferProps) {
    const { from, to, amount, tokenAddress } = props;
    console.log('transfer:', from, to, amount);
    if (!from) {
      return Error('from address error');
    }
    if (!to) {
      return Error('to address error');
    }
    if (amount.toNumber() <= 0) {
      return Error('amount error');
    }
    const _from: PublicKey = new PublicKey(from);
    const _to: PublicKey = new PublicKey(to);

    // 主币和Token区分
    if (!tokenAddress) {
      return this.sendTransation(
        [
          SystemProgram.transfer({
            fromPubkey: _from,
            toPubkey: _to,
            lamports: amount.multipliedBy(1e9).toNumber(),
          }),
        ],
        _from,
      );
    }
    return this.transferToken(props);
  }
}

export default new SolWallet('devnet');
