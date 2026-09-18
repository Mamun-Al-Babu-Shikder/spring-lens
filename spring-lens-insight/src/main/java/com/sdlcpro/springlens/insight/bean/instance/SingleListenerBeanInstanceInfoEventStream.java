package com.sdlcpro.springlens.insight.bean.instance;

import com.sdlcpro.springlens.insight.util.SafeListenerInvoker;
import com.sdlcpro.springlens.listener.bean.BeanInstanceInfoCollectListener;
import com.sdlcpro.springlens.model.bean.instance.BeanInstanceInfo;
import com.sdlcpro.springlens.util.Preconditions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.LinkedList;
import java.util.Queue;
import java.util.concurrent.locks.ReentrantLock;

public final class SingleListenerBeanInstanceInfoEventStream implements BeanInstanceInfoEventStream {
    private static final Logger logger = LoggerFactory.getLogger(SingleListenerBeanInstanceInfoEventStream.class);

    private volatile State state;
    private final ReentrantLock lock;
    private final Queue<BeanInstanceInfo> buffer;
    private volatile BeanInstanceInfoCollectListener listener;

    public SingleListenerBeanInstanceInfoEventStream() {
        this.state = State.BUFFERING;
        this.lock = new ReentrantLock();
        this.buffer = new LinkedList<>();
    }

    @Override
    public void publish(BeanInstanceInfo info) {
        Preconditions.notNull(info, "The BeanInstanceInfo must not be null");
        if (this.state == State.LIVE) {
            this.notifyListener(info);
            return;
        }

        this.lock.lock();
        try {
            if (this.state != State.LIVE) {
                this.buffer.add(info);
                return;
            }
        } finally {
            this.lock.unlock();
        }

        this.notifyListener(info);
    }

    @Override
    public void subscribe(BeanInstanceInfoCollectListener listener) {
        Preconditions.notNull(listener, "The BeanInstanceInfoCollectListener must not be null");
        if (this.state != State.BUFFERING) {
            logger.info("Bean bean=instance info collector listener already exists; ignoring this new one");
            return;
        }

        this.lock.lock();
        try {
            if (this.state != State.BUFFERING) {
                logger.info("Bean bean=instance info collector listener already exists; ignoring this new one");
                return;
            }

            this.listener = listener;
            this.state = State.REPLAYING;
        } finally {
            lock.unlock();
        }

        this.replay();
    }

    private void replay() {
        while (true) {
            BeanInstanceInfo info;
            this.lock.lock();
            try {
                info = this.buffer.poll();
                if (info == null) {
                    this.state = State.LIVE;
                    return;
                }
            } finally {
                this.lock.unlock();
            }

            this.notifyListener(info);
        }
    }

    private void notifyListener(BeanInstanceInfo info) {
        SafeListenerInvoker.invoke(
                Collections.singleton(this.listener),
                info,
                BeanInstanceInfoCollectListener::onBeanInstanceInfoCollect
        );
    }

    private enum State {
        BUFFERING,
        REPLAYING,
        LIVE
    }
}
